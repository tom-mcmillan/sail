import { Router } from 'express';
import { oauthServer } from '../services/oauth/authServer';

const router = Router();

// OAuth Authorization Server Metadata (RFC 8414)
router.get('/.well-known/oauth-authorization-server', oauthServer.getAuthorizationServerMetadata.bind(oauthServer));

// Dynamic Client Registration (RFC 7591)
router.post('/register', oauthServer.registerClient.bind(oauthServer));

// Authorization Endpoint (RFC 6749)
router.get('/authorize', oauthServer.authorize.bind(oauthServer));

// Token Endpoint (RFC 6749)
router.post('/token', oauthServer.token.bind(oauthServer));

// Token Introspection (RFC 7662)
router.post('/introspect', oauthServer.introspect.bind(oauthServer));

export default router;