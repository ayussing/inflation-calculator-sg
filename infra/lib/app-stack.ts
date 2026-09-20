import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cwActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as logs from "aws-cdk-lib/aws-logs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

export interface AppSecrets {
  databaseUrl: secretsmanager.Secret;
  dataGovSgApiKey: secretsmanager.Secret;
  ingestSecret: secretsmanager.Secret;
}

export interface AppStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  /** Email address to subscribe to the alerts SNS topic. Omit to skip the subscription. */
  alertEmail?: string;
}

export class AppStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly image: ecs.ContainerImage;
  public readonly secrets: AppSecrets;
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    // DATABASE_URL and DATA_GOV_SG_API_KEY come from Aiven / data.gov.sg, not AWS, so
    // these are created empty and must be populated post-deploy (see infra/README.md).
    // INGEST_SECRET is purely an internal shared secret, so CDK generates it.
    this.secrets = {
      databaseUrl: new secretsmanager.Secret(this, "DatabaseUrlSecret", {
        secretName: "inflation-calculator/database-url",
        description:
          "Aiven Postgres connection string (DATABASE_URL). Populate manually after deploy.",
      }),
      dataGovSgApiKey: new secretsmanager.Secret(this, "DataGovSgApiKeySecret", {
        secretName: "inflation-calculator/data-gov-sg-api-key",
        description:
          "data.gov.sg developer API key (DATA_GOV_SG_API_KEY). Optional — populate manually if used.",
      }),
      ingestSecret: new secretsmanager.Secret(this, "IngestSecret", {
        secretName: "inflation-calculator/ingest-secret",
        description: "Bearer token required to trigger GET /api/ingest.",
        generateSecretString: {
          excludePunctuation: true,
          passwordLength: 32,
        },
      }),
    };

    this.alertTopic = new sns.Topic(this, "AlertTopic", {
      displayName: "inflation-calculator alerts",
    });
    if (props.alertEmail) {
      this.alertTopic.addSubscription(new subscriptions.EmailSubscription(props.alertEmail));
    }

    this.cluster = new ecs.Cluster(this, "Cluster", {
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    // Built and pushed to ECR by CDK itself at `cdk deploy` time — no separate CI/CD
    // pipeline is needed to get a working image into ECS.
    this.image = ecs.ContainerImage.fromAsset(path.join(__dirname, "..", "..", "web"));

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Service", {
      cluster: this.cluster,
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      publicLoadBalancer: true,
      taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      taskImageOptions: {
        image: this.image,
        containerPort: 3000,
        environment: {
          NODE_ENV: "production",
        },
        secrets: {
          DATABASE_URL: ecs.Secret.fromSecretsManager(this.secrets.databaseUrl),
          DATA_GOV_SG_API_KEY: ecs.Secret.fromSecretsManager(this.secrets.dataGovSgApiKey),
          INGEST_SECRET: ecs.Secret.fromSecretsManager(this.secrets.ingestSecret),
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: "web",
          logRetention: logs.RetentionDays.ONE_MONTH,
        }),
      },
    });

    // /api/health checks DB connectivity, not just process liveness — use it directly.
    service.targetGroup.configureHealthCheck({
      path: "/api/health",
      healthyHttpCodes: "200",
    });

    const scaling = service.service.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 2 });
    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 70,
    });

    const errorAlarm = new cloudwatch.Alarm(this, "Alb5xxAlarm", {
      metric: service.targetGroup.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, {
        period: cdk.Duration.minutes(5),
        statistic: "sum",
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "ALB is returning 5xx responses from the target group.",
    });
    errorAlarm.addAlarmAction(new cwActions.SnsAction(this.alertTopic));

    const unhealthyHostsAlarm = new cloudwatch.Alarm(this, "UnhealthyHostsAlarm", {
      metric: service.targetGroup.metrics.unhealthyHostCount({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "One or more ECS tasks are failing the /api/health check.",
    });
    unhealthyHostsAlarm.addAlarmAction(new cwActions.SnsAction(this.alertTopic));

    new cdk.CfnOutput(this, "ServiceUrl", {
      value: `http://${service.loadBalancer.loadBalancerDnsName}`,
    });
  }
}
