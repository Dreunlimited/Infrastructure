import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { CommonEnvironmentProps } from "./common-props";
import { VpcConstruct } from "./vpc-construct";

export type EnvironmentConstructProps = Pick<
  CommonEnvironmentProps,
  | "containerRepo"
  | "hostedZone"
  | "availabilityZones"
  | "environmentName"
  | "natGateways"
>;

export class Environment extends Construct {
  private vpc: Vpc;

  constructor(scope: Construct, private props: EnvironmentConstructProps) {
    super(scope, `${props.environmentName}`);

    const { vpc } = new VpcConstruct(this, {
      environmentName: this.props.environmentName,
      natGateways: this.props.natGateways,
      availabilityZones: this.props.availabilityZones,
    });

    this.vpc = vpc;
  }

  add(createFn: (props: EnvironmentConstructProps, vpc: Vpc) => void) {
    createFn(this.props, this.vpc);
  }
}
