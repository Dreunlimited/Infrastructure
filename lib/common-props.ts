import { aws_route53 } from "aws-cdk-lib";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";

export interface CommonEnvironmentProps {
  vpc: Vpc;
  environmentName: string;
  containerRepo: Repository;
  hostedZone?: aws_route53.IHostedZone;
  privateHostedZone?: aws_route53.IHostedZone;
  availabilityZones: string[];
  natGateways: number;
}
