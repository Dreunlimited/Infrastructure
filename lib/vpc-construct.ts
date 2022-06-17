import { Construct } from "constructs";
import { aws_ec2 } from "aws-cdk-lib";
import { SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { CommonEnvironmentProps } from "./common-props";

export class VpcConstruct extends Construct {
  vpc: Vpc;

  constructor(
    scope: Construct,
    props: Pick<
      CommonEnvironmentProps,
      "environmentName" | "availabilityZones" | "natGateways"
    >
  ) {
    super(scope, `${props.environmentName}Environment`);

    this.vpc = new aws_ec2.Vpc(this, `${props.environmentName}Vpc`, {
      vpcName: `${props.environmentName}Vpc`,
      availabilityZones: props.availabilityZones,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      natGateways: props.natGateways,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `${props.environmentName}-Public`,
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: `${props.environmentName}-Private`,
          subnetType: SubnetType.PRIVATE_WITH_NAT,
        },
        {
          cidrMask: 28,
          name: `${props.environmentName}-Isolated`,
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
  }
}
