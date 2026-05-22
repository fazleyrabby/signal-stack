import { Injectable, Logger } from '@nestjs/common';
import { IPublisher } from '../publishers/publisher.interface';
import { XPublisher } from '../publishers/x.publisher';
import { FacebookPublisher } from '../publishers/facebook.publisher';
import { LinkedInPublisher } from '../publishers/linkedin.publisher';
import { BlueskyPublisher } from '../publishers/bluesky.publisher';

@Injectable()
export class PublisherRegistry {
  private readonly logger = new Logger(PublisherRegistry.name);
  private readonly registry = new Map<string, IPublisher>();

  constructor(
    private readonly xPublisher: XPublisher,
    private readonly facebookPublisher: FacebookPublisher,
    private readonly linkedInPublisher: LinkedInPublisher,
    private readonly blueskyPublisher: BlueskyPublisher,
  ) {
    this.registry.set('x', xPublisher);
    this.registry.set('facebook', facebookPublisher);
    this.registry.set('linkedin', linkedInPublisher);
    this.registry.set('bluesky', blueskyPublisher);
  }

  getPublisher(platform: string): IPublisher | undefined {
    const publisher = this.registry.get(platform);
    if (!publisher) {
      this.logger.warn(`No publisher registered for platform '${platform}'`);
    }
    return publisher;
  }

  getSupportedPlatforms(): string[] {
    return Array.from(this.registry.keys());
  }
}
