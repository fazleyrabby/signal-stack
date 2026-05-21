export interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export interface IPublisher {
  readonly platform: string;
  publish(text: string, credentials: any): Promise<PublishResult>;
  verifyCredentials?(credentials: any): Promise<boolean>;
}
