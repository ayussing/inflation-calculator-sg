#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { AppStack } from "../lib/app-stack";
import { IngestionStack } from "../lib/ingestion-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  // Singapore, since this is an SG-focused dataset. Override with CDK_DEFAULT_REGION.
  region: process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1",
};

// Pass with: cdk deploy --all -c alertEmail=you@example.com
const alertEmail = app.node.tryGetContext("alertEmail") as string | undefined;

const network = new NetworkStack(app, "InflationCalculatorNetworkStack", { env });

const appStack = new AppStack(app, "InflationCalculatorAppStack", {
  env,
  vpc: network.vpc,
  alertEmail,
});

new IngestionStack(app, "InflationCalculatorIngestionStack", {
  env,
  cluster: appStack.cluster,
  image: appStack.image,
  secrets: appStack.secrets,
  alertTopic: appStack.alertTopic,
});
