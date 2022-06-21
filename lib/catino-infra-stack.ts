import { Stack, StackProps, aws_route53, Duration } from "aws-cdk-lib";
import { aws_elasticloadbalancingv2 } from "aws-cdk-lib";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Repository, TagMutability } from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";
import MariaDbBackedFargateService from "./mariadb-backed-fargate-service-contruct";
import {
  Environment,
  EnvironmentConstructProps,
} from "./environment-construct";
import FrontendApplication from "./frontend-application-constuct";

export class CatinoInfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const hostedZoneId = "Z01039102W8W2MPHUF4VO"; //process.env.ROUTE_53_HOSTED_ZONE ?? "";

    // Create a repo for application
    const containerRepo = new Repository(this, "Catino", {
      imageScanOnPush: true,
      imageTagMutability: TagMutability.IMMUTABLE,
    });

    const hostedZone = aws_route53.HostedZone.fromHostedZoneAttributes(
      this,
      "CatinoHostedZone",
      {
        hostedZoneId,
        zoneName: "catino.co",
      }
    );

    this.setUpStaging(containerRepo, hostedZone);
  }

  private setUpStaging(
    containerRepo: Repository,
    hostedZone: aws_route53.IHostedZone
  ) {
    const stagingAvailabilityZones = ["us-east-1a", "us-east-1b", "us-east-1c"];

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
        domain: "dev-api.catino.co",
        publicFacing: true,
        servicePort: 3333,
        numberOfInstances: 1,
        dbBackupRetentionInDays: 1,
        dbDeleteProtection: false,
        sslCertificatateArn:
          "arn:aws:acm:us-east-1:467725377159:certificate/bb7798f7-b836-469e-afc4-843e36569e34",
        healthCheck: {
          port: "3333",
          path: "/",
          protocol: aws_elasticloadbalancingv2.Protocol.HTTP,
          healthyHttpCodes: "404",
          enabled: true,
          interval: Duration.minutes(1),
          unhealthyThresholdCount: 5,
        },
      });

      new FrontendApplication(this, "CatinoStagingFrontend", {
        domain: "staging.catino.co",
        hostedZone,
        sslCertificateArn:
          "arn:aws:acm:us-east-1:467725377159:certificate/bb7798f7-b836-469e-afc4-843e36569e34",
      });
    });
  }
}
