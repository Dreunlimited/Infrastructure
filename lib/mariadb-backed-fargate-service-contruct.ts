import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { CommonEnvironmentProps } from "./common-props";
import { MariaDbDatabase } from "./mariadb-database-construct";
import { FargateApplication } from "./fargate-application-construct";
import { aws_elasticloadbalancingv2 } from "aws-cdk-lib";
import { posix } from "path";

interface ServiceConstructProps extends CommonEnvironmentProps {
  serviceName: string;
  servicePort: number;
  publicFacing: boolean;
  domain: string;
  numberOfInstances: number;
  dbBackupRetentionInDays: number;
  dbDeleteProtection: boolean;
  sslCertificatateArn: string;
  healthCheck?: aws_elasticloadbalancingv2.HealthCheck;
}

export default class MariaDbBackedFargateService extends Construct {
  constructor(scope: Construct, private readonly props: ServiceConstructProps) {
    super(scope, props.serviceName);

    const databaseLayer = new MariaDbDatabase(this, {
      vpc: props.vpc,
      name: props.serviceName,
      instanceType: InstanceType.of(
        InstanceClass.BURSTABLE3,
        InstanceSize.SMALL
      ),
      backupRetentionInDays: props.dbBackupRetentionInDays,
      deleteProtection: props.dbDeleteProtection,
    });

    const application = new FargateApplication(this, {
      containerRepo: this.props.containerRepo,
      db: databaseLayer.db,
      publicHostedZone: this.props.hostedZone,
      privateHostedZone: this.props.privateHostedZone,
      vpc: props.vpc,
      containerPort: props.servicePort,
      name: props.serviceName,
      publicFacing: props.publicFacing,
      domain: props.domain,
      desiredCount: props.numberOfInstances,
      certificateArn: props.sslCertificatateArn,
      healthCheck: props.healthCheck,
    });

    console.log("**** DB Details ****");
    console.log(`Host: ${databaseLayer.db.dbInstanceEndpointAddress}`);
    console.log(`Port: ${databaseLayer.db.dbInstanceEndpointPort}`);
    console.log(`DB Name: ${props.serviceName}`);
    console.log(`Username: ${databaseLayer.credentials.username}`);
    console.log(`SecretId: ${databaseLayer.db.secret?.secretArn}`);
  }
}
