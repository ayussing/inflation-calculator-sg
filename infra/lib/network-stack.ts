import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Single NAT gateway (not one per AZ) — the main recurring cost in this stack.
    // Fargate tasks live in the private subnets and need outbound internet access to
    // reach Aiven Postgres and data.gov.sg, since there is no database to provision
    // in-VPC. Bump to 2 for AZ-level NAT redundancy, or drop to 0 (with tasks placed in
    // public subnets instead) to eliminate the cost at the expense of security posture.
    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });
  }
}
