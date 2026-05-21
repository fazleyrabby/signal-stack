import { Injectable, Logger } from '@nestjs/common';
import { IPublisher } from '../publishers/publisher.interface';
import { XPublisher } from '../publishers/x.publisher';
import { FacebookPublisher } from '../publishers/facebook.publisher';

/**
 * Registry/factory for platform publishers.
 * Add new platforms here — the scheduler and controller are decoupled from specifics.
 */
@Injectable()
export class PublisherRegistry {
  private readonly logger = new Logger(PublisherRegistry.name);
  private readonly registry = new Map<string, IPublisher>();

  constructor(
    private readonly xPublisher: XPublisher,
    private readonly facebookPublisher: FacebookPublisher,
  ) {
    this.registry.set('x', xPublisher);
    this.registry.set('facebook', facebookPublisher);
    // Future: this.registry.set('linkedin', linkedinPublisher);
    // Future: this.registry.set('bluesky', blueskyPublisher);
  }

  getPublisher(platform: string): IPublisher {
    const publisher = this.registry.get(platform);
    if (!publisher) {
      this.logger.warn(`No publisher registered for platform '${platform}'. Falling back to X.`);
      return this.xPublisher;
    }
    return publisher;
  }

  getSupportedPlatforms(): string[] {
    return Array.from(this.registry.keys());
  }
}
