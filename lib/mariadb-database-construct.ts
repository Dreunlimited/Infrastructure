import { Duration } from "aws-cdk-lib";
import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  MariaDbEngineVersion,
} from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";
import { CommonEnvironmentProps } from "./common-props";

interface DatabaseConstructProps extends Pick<CommonEnvironmentProps, "vpc"> {
  name: string;
  instanceType: InstanceType;
  deleteProtection: boolean;
  backupRetentionInDays: number;
}

export class MariaDbDatabase extends Construct {
  credentials: Credentials;
  db: DatabaseInstance;

  constructor(
    scope: Construct,
    private readonly props: DatabaseConstructProps
  ) {
    super(scope, `${props.name}`);

    let mariaDbSecurityGroup = this.createMariadbSecurityGroup(
      props.vpc,
      props.name
    );

    this.credentials = Credentials.fromGeneratedSecret(this.props.name);
    console.log("Creating db instaance");

    this.db = new DatabaseInstance(this, `${this.props.name}`, {
      engine: DatabaseInstanceEngine.mariaDb({
        version: MariaDbEngineVersion.VER_10_5,
      }),
      instanceType: this.props.instanceType,
      instanceIdentifier: `${this.props.name}`,
      databaseName: this.props.name,
      credentials: this.credentials,
      vpc: this.props.vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [mariaDbSecurityGroup],
      deletionProtection: props.deleteProtection,
      backupRetention: Duration.days(props.backupRetentionInDays),
      multiAz: true,
    });
  }

  private createMariadbSecurityGroup(vpc: Vpc, dbName: string) {
    let dbSecurityGroup = new SecurityGroup(this, `${dbName}SecurityGroup`, {
      vpc,
      allowAllOutbound: true,
      description: "Allows access to RDS db",
      securityGroupName: `${dbName}SecurityGroup`,
    });

    console.log("Adding ingress rule that only allows from inside vpc");

    dbSecurityGroup.addIngressRule(
      Peer.ipv4(vpc.vpcCidrBlock),
      Port.tcp(3306),
      "Allow connection to mysql from withing vpc"
    );
    return dbSecurityGroup;
  }
}
