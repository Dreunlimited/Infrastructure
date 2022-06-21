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
      maxAzs: 3,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      natGateways: props.natGateways,
      subnetConfiguration: [
        {
          cidrMask: 26,
          name: `${props.environmentName}-Public`,
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 25,
          name: `${props.environmentName}-Private`,
          subnetType: SubnetType.PRIVATE_WITH_NAT,
        },
        {
          cidrMask: 26,
          name: `${props.environmentName}-Isolated`,
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    //   props.availabilityZones.forEach((az) => {
    //     const publicSubnet = new aws_ec2.PublicSubnet(
    //       this.vpc,
    //       `${props.environmentName}-Public-${az}`,
    //       {
    //         vpcId: this.vpc.vpcId,
    //         availabilityZone: az,
    //         mapPublicIpOnLaunch: true,
    //         cidrBlock: "10.0.0.0/26",
    //       }
    //     );

    //     const privateSubnet = new aws_ec2.PrivateSubnet(
    //       this.vpc,
    //       `${props.environmentName}-Private-${az}`,
    //       {
    //         vpcId: this.vpc.vpcId,
    //         availabilityZone: az,
    //         mapPublicIpOnLaunch: true,
    //         cidrBlock: "10.0.0.64/25",
    //       }
    //     );

    //     const isolatedSubnet = new aws_ec2.Subnet(
    //       this.vpc,
    //       `${props.environmentName}-Isolated-${az}`,
    //       {
    //         vpcId: this.vpc.vpcId,
    //         availabilityZone: az,
    //         mapPublicIpOnLaunch: true,
    //         cidrBlock: "10.0.0.64/25",
    //       }
    //     );
    //   });
  }
}
