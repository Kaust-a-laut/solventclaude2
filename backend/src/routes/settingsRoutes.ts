import { Router } from 'express';
import { settingsService } from '../services/settingsService';
import { handleRouteError } from '../utils/routeErrors';

const router = Router();

// Get all settings
router.get('/', async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    res.json(settings);
  } catch (error) {
    handleRouteError({ res, error, context: 'settings-get' });
  }
});

// Update settings
router.post('/', async (req, res) => {
  try {
    const settings = await settingsService.updateSettings(req.body);
    res.json(settings);
  } catch (error) {
    handleRouteError({ res, error, context: 'settings-update' });
  }
});

// Get provider configuration
router.get('/providers/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const config = await settingsService.getProviderConfig(providerId);
    if (!config) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    res.json(config);
  } catch (error) {
    handleRouteError({ res, error, context: 'settings-provider-get' });
  }
});

// Update provider configuration
router.post('/providers/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const config = await settingsService.updateProviderConfig(providerId, req.body);
    res.json(config);
  } catch (error) {
    handleRouteError({ res, error, context: 'settings-provider-update' });
  }
});

// Get all available providers
router.get('/providers', async (req, res) => {
  try {
    const providers = await settingsService.getAvailableProviders();
    res.json(providers.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      version: p.version,
      defaultModel: p.defaultModel,
      capabilities: p.capabilities,
      isReady: p.isReady()
    })));
  } catch (error) {
    handleRouteError({ res, error, context: 'settings-providers-list' });
  }
});

// Get provider capabilities
router.get('/providers/:providerId/capabilities', async (req, res) => {
  try {
    const { providerId } = req.params;
    const capabilities = await settingsService.getProviderCapabilities(providerId);
    res.json(capabilities);
  } catch (error) {
    handleRouteError({ res, error, context: 'settings-provider-capabilities' });
  }
});

// Validate provider API key
router.post('/providers/:providerId/validate-key', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    const isValid = await settingsService.validateProviderApiKey(providerId, apiKey);
    res.json({ valid: isValid });
  } catch (error) {
    handleRouteError({ res, error, context: 'settings-validate-key' });
  }
});

export default router;