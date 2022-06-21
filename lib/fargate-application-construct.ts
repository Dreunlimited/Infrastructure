import {
  aws_certificatemanager,
  aws_ec2,
  aws_ecs,
  aws_elasticloadbalancingv2,
  aws_route53,
  aws_route53_targets,
  aws_secretsmanager,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Peer, Port, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Credentials, DatabaseInstance } from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";

interface ApplicationConstructProps {
  vpc: Vpc;
  db: DatabaseInstance;
  containerRepo: Repository;
  publicHostedZone?: aws_route53.IHostedZone;
  privateHostedZone?: aws_route53.IHostedZone;
  certificateArn: string;
  name: string;
  domain?: string;
  publicFacing: boolean;
  containerPort: number;
  desiredCount: number;
  healthCheck?: aws_elasticloadbalancingv2.HealthCheck;
}

export class FargateApplication extends Construct {
  constructor(scope: Construct, private props: ApplicationConstructProps) {
    super(scope, `${props.name}Application`);

    const ecsCluster = new aws_ecs.Cluster(this, props.name, {
      vpc: props.vpc,
    });

    const taskDefinition = new aws_ecs.FargateTaskDefinition(
      ecsCluster,
      `${props.name}ApplicationTaskDefinition`,
      {
        cpu: 512,
        memoryLimitMiB: 2048,
      }
    );

    const secretFromManager = aws_secretsmanager.Secret.fromSecretCompleteArn(
      this,
      `${props.name}DBSecret`,
      this.props.db.secret!.secretFullArn!
    );

    const dbSecret = Credentials.fromSecret(props.db.secret!);
    const { username, password } = dbSecret;

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
        COGNITO_CLIENT_ID: "6s77vcmadi3tms5ukj,h7m07lll", // Remove
        AUTHORIZER_ARN:
          "arn:aws:cognito-idp:us-east-1:467725377159:userpool/us-east-1_R7Sxj23De", // Remove
        COGNITO_POOL_ID: "us-east-1_R7Sxj23De", // Remove
        DATABASE_URL: `mysql://${username}:${password?.unsafeUnwrap()}@${
          props.db.dbInstanceEndpointAddress
        }:${props.db.dbInstanceEndpointPort}/${props.name}?schema=public`,
      },
      cpu: 512,
      memoryReservationMiB: 1024,
      memoryLimitMiB: 2048,
      logging: aws_ecs.LogDriver.awsLogs({
        logGroup: new LogGroup(this, `${props.name}LogGroup`, {
          logGroupName: `${props.name}LogGroup`,
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.ONE_YEAR,
        }),
        streamPrefix: props.name,
      }),
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
          subnets: props.vpc.privateSubnets,
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

    const cerficate = aws_certificatemanager.Certificate.fromCertificateArn(
      this,
      `${props.name}ListenerCertificate`,
      props.certificateArn
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
        protocol: aws_elasticloadbalancingv2.ApplicationProtocol.HTTP,
        healthCheck: props.healthCheck,
      }),
    });

    // Add the dns records for the application and point it to the load balancer
    const record = new aws_route53.ARecord(this, `${props.name}ARecord`, {
      zone: serviceHostedZone!,
      recordName: `${props.domain}.`,
      target: aws_route53.RecordTarget.fromAlias(
        new aws_route53_targets.LoadBalancerTarget(loadBalancer)
      ),
    });
  }
}
