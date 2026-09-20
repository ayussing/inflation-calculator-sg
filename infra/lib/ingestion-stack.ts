import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sns from "aws-cdk-lib/aws-sns";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { AppSecrets } from "./app-stack";

export interface IngestionStackProps extends cdk.StackProps {
  cluster: ecs.Cluster;
  image: ecs.ContainerImage;
  secrets: AppSecrets;
  alertTopic: sns.Topic;
  /**
   * EventBridge cron expression for the ingestion schedule. SingStat publishes CPI
   * roughly mid-month; the exact day is a tunable default, not load-bearing.
   * Defaults to 06:00 UTC on the 24th of every month.
   */
  scheduleCron?: events.CronOptions;
}

export class IngestionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IngestionStackProps) {
    super(scope, id, props);

    const taskDefinition = new ecs.FargateTaskDefinition(this, "IngestionTaskDef", {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    taskDefinition.addContainer("IngestionContainer", {
      image: props.image,
      command: ["npx", "tsx", "scripts/ingest-cpi.ts"],
      environment: {
        NODE_ENV: "production",
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(props.secrets.databaseUrl),
        DATA_GOV_SG_API_KEY: ecs.Secret.fromSecretsManager(props.secrets.dataGovSgApiKey),
        INGEST_SECRET: ecs.Secret.fromSecretsManager(props.secrets.ingestSecret),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "ingestion",
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    const schedule = events.Schedule.cron(
      props.scheduleCron ?? { minute: "0", hour: "6", day: "24", month: "*", year: "*" }
    );

    new events.Rule(this, "IngestionScheduleRule", {
      schedule,
      targets: [
        new targets.EcsTask({
          cluster: props.cluster,
          taskDefinition,
          subnetSelection: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        }),
      ],
    });

    // Ingestion-failure alarm: fires whenever a run of this task definition family
    // stops with a non-zero exit code, so a broken monthly ingestion pages the same
    // channel as the live service's health alarms.
    new events.Rule(this, "IngestionFailureRule", {
      eventPattern: {
        source: ["aws.ecs"],
        detailType: ["ECS Task State Change"],
        detail: {
          lastStatus: ["STOPPED"],
          clusterArn: [props.cluster.clusterArn],
          containers: {
            exitCode: [{ "anything-but": 0 }],
          },
        },
      },
      targets: [
        new targets.SnsTopic(props.alertTopic, {
          message: events.RuleTargetInput.fromText(
            "CPI ingestion task failed. Check the /ecs/IngestionTaskDef* CloudWatch log group for details."
          ),
        }),
      ],
    });
  }
}
