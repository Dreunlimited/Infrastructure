import {
  aws_certificatemanager,
  aws_ec2,
  aws_ecs,
  aws_elasticloadbalancingv2,
  aws_route53,
  aws_secretsmanager,
} from "aws-cdk-lib";
import { Peer, Port, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { DatabaseInstance } from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";

interface ApplicationConstructProps {
  vpc: Vpc;
  db: DatabaseInstance;
  containerRepo: Repository;
  publicHostedZone?: aws_route53.IHostedZone;
  privateHostedZone?: aws_route53.IHostedZone;
  name: string;
  domain?: string;
  publicFacing: boolean;
  containerPort: number;
  desiredCount: number;
}

export class FargateApplication extends Construct {
  constructor(scope: Construct, private props: ApplicationConstructProps) {
    super(scope, `${props.name}"Application"`);

    const ecsCluster = new aws_ecs.Cluster(this, props.name);
    const taskDefinition = new aws_ecs.FargateTaskDefinition(
      ecsCluster,
      `${props.name}ApplicationTaskDefinition`,
      {
        cpu: 0.5,
        memoryLimitMiB: 2048,
      }
    );

    const secretFromManager = aws_secretsmanager.Secret.fromSecretCompleteArn(
      this,
      `${props.name}DBSecret`,
      this.props.db.secret!.secretFullArn!
    );

    taskDefinition.addContainer(props.name, {
      image: aws_ecs.ContainerImage.fromEcrRepository(this.props.containerRepo),
      portMappings: [
        {
          containerPort: props.containerPort,
        },
      ],
      secrets: {
        DB_CREDENTIALS: aws_ecs.Secret.fromSecretsManager(secretFromManager),
      },
      environment: {
        DB_HOST: this.props.db.dbInstanceEndpointAddress,
        DB_PORT: this.props.db.dbInstanceEndpointPort,
      },
    });

    const applicationSecurityGroup = new aws_ec2.SecurityGroup(
      this,
      `${props.name}ApplicationSecurityGroup`,
      {
        vpc: this.props.vpc,
        allowAllOutbound: true,
        description: `Allows access to ${props.name} application`,
        securityGroupName: `${props.name}ApplicationSecurityGroup`,
      }
    );

    console.log("Adding ingress rule that only allows from inside vpc");

    applicationSecurityGroup.addIngressRule(
      Peer.ipv4(this.props.vpc.vpcCidrBlock),
      Port.tcp(props.containerPort),
      "Allow connection to mysql from withing vpc"
    );

    const service = new aws_ecs.FargateService(
      ecsCluster,
      `${props.name}FargateService`,
      {
        cluster: ecsCluster,
        taskDefinition,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE_WITH_NAT,
        },
        desiredCount: props.desiredCount,
        assignPublicIp: false,
        securityGroups: [applicationSecurityGroup],
        serviceName: `${props.name}FargateService`,
      }
    );

    const loadBalancer = new aws_elasticloadbalancingv2.ApplicationLoadBalancer(
      this,
      `${props.name}LoadBalancer`,
      {
        vpc: this.props.vpc,
        internetFacing: props.publicFacing,
        vpcSubnets: {
          subnetType: props.publicFacing
            ? SubnetType.PUBLIC
            : SubnetType.PRIVATE_WITH_NAT,
        },
      }
    );

    const serviceHostedZone = props.publicFacing
      ? this.props.publicHostedZone
      : this.props.privateHostedZone;

    const cerficate = new aws_certificatemanager.Certificate(
      this,
      `${props.name}ListenerCertificate`,
      {
        domainName: props.domain!,
        validation:
          aws_certificatemanager.CertificateValidation.fromDns(
            serviceHostedZone
          ),
      }
    );

    const listener = loadBalancer.addListener(
      `${props.name}LoadBalancerListener`,
      { port: 443, certificates: [cerficate] }
    );

    service.registerLoadBalancerTargets({
      containerName: props.name,
      containerPort: props.containerPort,
      newTargetGroupId: `${props.name}ApplicationTargetGroup`,
      listener: aws_ecs.ListenerConfig.applicationListener(listener, {
        protocol: aws_elasticloadbalancingv2.ApplicationProtocol.HTTPS,
      }),
    });
  }
}
