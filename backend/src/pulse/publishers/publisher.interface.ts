export interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export interface IPublisher {
  publish(text: string, credentials: any): Promise<PublishResult>;
}
