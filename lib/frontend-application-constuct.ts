import {
  aws_certificatemanager,
  aws_cloudfront,
  aws_cloudfront_origins,
  aws_route53,
  aws_route53_targets,
  aws_s3,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface FrontendApplicationProps {
  domain: string;
  sslCertificateArn: string;
  hostedZone: aws_route53.IHostedZone;
}

export default class FrontendApplication extends Construct {
  constructor(scope: Construct, id: string, props: FrontendApplicationProps) {
    super(scope, id);

    // Create S3 bucket
    const bucket = new aws_s3.Bucket(this, `${id}Bucket`);

    const certificate = aws_certificatemanager.Certificate.fromCertificateArn(
      this,
      `${id}ListenerCertificate`,
      props.sslCertificateArn
    );

    const distribution = new aws_cloudfront.Distribution(
      scope,
      `${id}Distribution`,
      {
        defaultBehavior: {
          origin: new aws_cloudfront_origins.S3Origin(bucket),
        },
        domainNames: [props.domain],
        certificate,
        defaultRootObject: "/index.html",
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
        ],
      }
    );

    //
    const record = new aws_route53.ARecord(this, `${id}ARecord`, {
      zone: props.hostedZone,
      recordName: `${props.domain}.`,
      target: aws_route53.RecordTarget.fromAlias(
        new aws_route53_targets.CloudFrontTarget(distribution)
      ),
    });
  }
}
