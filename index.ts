/**
 * index.ts
 *
 * Copyright MIT
 */

import {
  Context,
  S3Event,
  SQSEvent,
  SQSRecord,
} from 'aws-lambda';

// eslint-disable-next-line import/no-extraneous-dependencies
import AWS from 'aws-sdk';

import serverless from 'serverless-http';
import express from 'express';
import { spawnSync } from 'child_process';
import {
  readFileSync, writeFileSync, unlinkSync,
} from 'fs';

const app = express();

const s3 = new AWS.S3();

interface HeaderOption {
  'Access-Control-Allow-Origin': string;
}

export type ApiGatewayResponse = {
  headers: HeaderOption;
  statusCode: number;
  body: string;
};

app.get('/', (_: any, res: any) => res.status(200).json({
  message: 'Ok',
}));

app.get('/hello', (_: any, res: any) => res.status(200).json({
  message: 'Hello from path!',
}));

app.use((_: any, res: any) => res.status(404).json({
  error: 'Not Found',
}));

export const apiGatewayHandler = serverless(app);

/**
 * Main handler for lambba
 */
export async function s3Handler(
  _: Context,
  event: S3Event,
): Promise<any> {
  // This impletmentation is an example of how to convert image to gif using ffmpeg
  if (!event.Records) {
    // eslint-disable-next-line no-console
    console.log('not an s3 invocation!');
    return;
  }
  for (let i = 0; i < event.Records.length; i += 1) {
    const record = event.Records[i];
    if (!record.s3) {
      // eslint-disable-next-line no-console
      console.log('not an s3 invocation!');
      // eslint-disable-next-line no-continue
      continue;
    }
    if (record.s3.object.key.endsWith('.gif')) {
      // eslint-disable-next-line no-console
      console.log('already a gif');
      // eslint-disable-next-line no-continue
      continue;
    }
    // get the file
    // eslint-disable-next-line no-await-in-loop
    const s3Object = await s3
      .getObject({
        Bucket: record.s3.bucket.name,
        Key: record.s3.object.key,
      })
      .promise();
    // write file to disk
    writeFileSync(`/tmp/${record.s3.object.key}`, s3Object.Body);
    // convert to gif!
    spawnSync(
      '/opt/ffmpeg/ffmpeg',
      [
        '-i',
        `/tmp/${record.s3.object.key}`,
        '-f',
        'gif',
        `/tmp/${record.s3.object.key}.gif`,
      ],
      { stdio: 'inherit' },
    );
    // read gif from disk
    const gifFile = readFileSync(`/tmp/${record.s3.object.key}.gif`);
    // delete the temp files
    unlinkSync(`/tmp/${record.s3.object.key}.gif`);
    unlinkSync(`/tmp/${record.s3.object.key}`);
    // upload gif to s3
    // eslint-disable-next-line no-await-in-loop
    await s3
      .putObject({
        Bucket: record.s3.bucket.name,
        Key: `${record.s3.object.key}.gif`,
        Body: gifFile,
      })
      .promise();
  }
}

/**
 * SQS Event handler
 */
export async function sqsHandler(
  _: Context,
  event: SQSEvent,
): Promise<void> {
  for (let i = 0; i < event.Records.length; i += 1) {
    const record: SQSRecord = event.Records.length[i];
    console.log('Event: %o', record); // eslint-disable-line
  }
}
