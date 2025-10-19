import AWS from 'aws-sdk';
import { CortexEvent } from '../../../api/shared/types/event';
import logger from '../../../utils/logger';
import { config } from '../../../infrastructure/config/environment';

const s3 = new AWS.S3({
  region: config.aws.region,
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
});

const BUCKET = config.aws.s3Bucket;

export async function saveEventToS3(event: CortexEvent) {
  try {
    const key = `events/${new Date().toISOString().split('T')[0]}/${event.service}.json`;
    const params = {
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(event),
      ContentType: 'application/json'
    }
    await s3.putObject(params).promise();
    logger.info(`📤 Event saved to S3: ${key}`);
  } catch (error) {
    logger.error(`❌ Error saving event to S3: ${error}`);
    throw error;
  }
}