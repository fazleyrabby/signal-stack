import { Controller, Get, Query, Res, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { DraftsRepository } from '../drafts/drafts.repository';
import { PulseEncryptionService } from '../services/pulse-encryption.service';
import { logEvent } from '../../common/logger';

@Controller('api/admin/pulse/oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly draftsRepository: DraftsRepository,
    private readonly encryption: PulseEncryptionService,
  ) {}

  @Get('linkedin')
  async linkedinAuth(@Res() res: Response) {
    let clientId = process.env.LINKEDIN_CLIENT_ID || '';
    const activeAccount = await this.draftsRepository.findActiveAccount('linkedin');
    if (activeAccount && activeAccount.apiKey) {
      try { clientId = this.encryption.decrypt(activeAccount.apiKey); } catch {}
    }
    clientId = clientId.trim();
    if (!clientId) {
      throw new HttpException('LINKEDIN_CLIENT_ID not configured in env or database', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    
    // Determine the callback URL dynamically based on NEXT_PUBLIC_API_URL or default
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const redirectUri = `${apiUrl}/api/admin/pulse/oauth/linkedin/callback`;
    
    let scope = 'w_member_social profile openid';
    if (activeAccount && activeAccount.handle) {
      const rawHandle = activeAccount.handle.replace(/^@/, '').trim();
      if (/^\d+$/.test(rawHandle)) {
        scope += ' w_organization_social';
      }
    }
    
    const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    res.redirect(url);
  }

  @Get('linkedin/callback')
  async linkedinCallback(@Query('code') code: string, @Query('error') error: string, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    
    if (error) {
      this.logger.error(`LinkedIn OAuth error: ${error}`);
      return res.redirect(`${frontendUrl}/admin/pulse?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return res.redirect(`${frontendUrl}/admin/pulse?error=NoCodeProvided`);
    }

      const activeAccount = await this.draftsRepository.findActiveAccount('linkedin');
      
      let clientId = process.env.LINKEDIN_CLIENT_ID || '';
      let clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';

      if (activeAccount && activeAccount.apiKey && activeAccount.apiSecret) {
        try {
          clientId = this.encryption.decrypt(activeAccount.apiKey);
          clientSecret = this.encryption.decrypt(activeAccount.apiSecret);
        } catch {}
      }

      clientId = clientId.trim();
      clientSecret = clientSecret.trim();
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const redirectUri = `${apiUrl}/api/admin/pulse/oauth/linkedin/callback`;

      try {
        this.logger.log(`Attempting LinkedIn token exchange with clientId: ${clientId}, redirectUri: ${redirectUri}`);
        // 1. Exchange code for access token
        const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
          }),
        });

        const tokenData = await tokenRes.json();
        this.logger.log(`LinkedIn token response status: ${tokenRes.status}, body: ${JSON.stringify(tokenData)}`);
        
        if (!tokenRes.ok) {
          throw new Error(tokenData.error_description || tokenData.error || 'Failed to get access token');
        }

        const accessToken = tokenData.access_token;

        // 2. Fetch user profile (URN & name) using the access token
        const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const profileData = await profileRes.json();
        this.logger.log(`LinkedIn userinfo response status: ${profileRes.status}, body: ${JSON.stringify(profileData)}`);
        
        if (!profileRes.ok) {
          throw new Error(profileData.message || 'Failed to get user profile');
        }

        const personUrn = profileData.sub;
        let finalHandle = profileData.name || profileData.given_name || personUrn;
        let targetUrn = `urn:li:person:${personUrn}`;

        // If the user provided a numeric handle (e.g. "@12345678"), treat it as a LinkedIn Company Page ID
        if (activeAccount && activeAccount.handle) {
          const rawHandle = activeAccount.handle.replace(/^@/, '').trim();
          if (/^\d+$/.test(rawHandle)) {
            targetUrn = `urn:li:organization:${rawHandle}`;
            finalHandle = `Page: ${rawHandle}`;
          }
        }

        if (activeAccount) {
          await this.draftsRepository.updateAccount(activeAccount.id, {
            handle: finalHandle,
            accessToken: this.encryption.encrypt(accessToken),
            accessTokenSecret: this.encryption.encrypt(targetUrn),
            isActive: true,
          });
        } else {
          await this.draftsRepository.createAccount({
            platform: 'linkedin',
            handle: finalHandle,
            apiKey: this.encryption.encrypt(clientId),
            apiSecret: this.encryption.encrypt(clientSecret),
            accessToken: this.encryption.encrypt(accessToken),
            accessTokenSecret: this.encryption.encrypt(targetUrn),
            isActive: true,
          });
        }

        logEvent('info', 'pulse_account_connected', { handle: finalHandle, platform: 'linkedin' });

      return res.redirect(`${frontendUrl}/admin/pulse?success=LinkedInConnected`);
    } catch (err: any) {
      this.logger.error(`LinkedIn OAuth callback failed: ${err.message}`);
      return res.redirect(`${frontendUrl}/admin/pulse?error=${encodeURIComponent(err.message)}`);
    }
  }
}
