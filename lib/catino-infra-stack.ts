import { Stack, StackProps, aws_route53 } from "aws-cdk-lib";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Repository, TagMutability } from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";
import MariaDbBackedFargateService from "./mariadb-backed-fargate-service-contruct";
import {
  Environment,
  EnvironmentConstructProps,
} from "./environment-construct";

export class CatinoInfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const hostendZoneId = process.env.ROUTE_53_HOSTED_ZONE ?? "";

    // Create a repo for application
    const containerRepo = new Repository(this, "Catino", {
      imageScanOnPush: true,
      imageTagMutability: TagMutability.IMMUTABLE,
    });

    const hostedZone = aws_route53.HostedZone.fromHostedZoneId(
      this,
      "CatinoHostedZone",
      hostendZoneId
    );

    this.setUpStaging(containerRepo, hostedZone);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'CatinoInfraQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }

  private setUpStaging(
    containerRepo: Repository,
    hostedZone: aws_route53.IHostedZone
  ) {
    const stagingAvailabilityZones = ["us-east-1a", "us-east-1b"];

    const stagingEnvironment = new Environment(this, {
      environmentName: "Staging",
      containerRepo: containerRepo,
      hostedZone: hostedZone,
      availabilityZones: stagingAvailabilityZones,
      natGateways: 1,
    });

    stagingEnvironment.add((envProps: EnvironmentConstructProps, vpc: Vpc) => {
      new MariaDbBackedFargateService(this, {
        serviceName: `Catino${envProps.environmentName}`,
        ...envProps,
        vpc,
        domain: "dev-api.catino.com",
        publicFacing: true,
        servicePort: 3333,
        numberOfInstances: 1,
        dbBackupRetentionInDays: 1,
        dbDeleteProtection: true,
      });
    });
  }
}
