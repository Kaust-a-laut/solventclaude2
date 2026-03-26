import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';

import mammoth from 'mammoth';

const router = Router();
// Allow dynamic project root, but default to a dedicated 'projects' or empty directory
const rootDir = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../../');

// Security: Define permitted root paths for file access
// SOLVENT_INTERNAL_DEV bypass is removed for security - all access must go through secure path validation
const permittedRoots: string[] = [
  path.resolve(rootDir),
  path.resolve(__dirname, '../../uploads')
].map(p => path.resolve(p)); // Ensure all paths are resolved

// Multer configuration
const uploadDir = path.resolve(__dirname, '../../uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Strip directory components from the original name to prevent path traversal
    const safeName = path.basename(file.originalname);
    const uniqueName = `${Date.now()}-${safeName}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const filePath = req.file.path;
    const extension = path.extname(req.file.originalname).toLowerCase();
    let content = '';

    // Extract text content based on file type
    if (extension === '.pdf') {
      const dataBuffer = await fs.readFile(filePath);
      const { default: pdf } = await import('pdf-parse');
      const data = await (pdf as any)(dataBuffer);
      content = data.text;
    } else if (['.docx', '.doc'].includes(extension)) {
      const result = await mammoth.extractRawText({ path: filePath });
      content = result.value;
    } else if (['.txt', '.ts', '.js', '.py', '.json', '.md', '.tsx', '.jsx'].includes(extension)) {
      content = await fs.readFile(filePath, 'utf-8');
    }

    res.json({
      status: 'success',
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `/files/${req.file.filename}`,
      content: content.substring(0, 50000) // Limit content size for prompt safety
    });
  } catch (error: any) {
    console.error('Upload processing error:', error);
    res.status(500).json({ error: 'Failed to process uploaded file' });
  }
});

async function getFileTree(dir: string, base: string = ''): Promise<any[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nodes = [];

    for (const entry of entries) {
      if (['node_modules', '.git', 'dist', '.next'].includes(entry.name)) continue;
      
      const relPath = path.join(base, entry.name);
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          type: 'directory',
          path: relPath,
          children: await getFileTree(fullPath, relPath)
        });
      } else {
        nodes.push({
          name: entry.name,
          type: 'file',
          path: relPath
        });
      }
    }

    return nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });
  } catch (e) {
    return [];
  }
}

router.get('/list', async (req, res) => {
  try {
    // Use the primary permitted root (project root)
    const tree = await getFileTree(permittedRoots[0]);
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

/**
 * Validates and resolves a user-provided path to a secure absolute path.
 * 
 * Security measures:
 * 1. Resolves the path to an absolute path
 * 2. Resolves symlinks to their real paths (prevents symlink attacks)
 * 3. Validates the path starts with a permitted root (with trailing separator to prevent prefix attacks)
 * 4. Checks against an allowlist of permitted root directories
 * 
 * @param userPath - The user-provided relative path
 * @param root - The root directory to resolve against
 * @returns The validated absolute path
 * @throws {Error} If the path is outside permitted roots or doesn't exist
 */
async function getSecurePath(userPath: string, root: string): Promise<string> {
  // Resolve to absolute path
  const resolvedPath = path.resolve(root, userPath);
  
  // Security: Use trailing separator to prevent prefix attacks (e.g., /home/user vs /home/user-docs)
  const normalizedRoot = path.resolve(root);
  const rootWithSeparator = normalizedRoot.endsWith(path.sep) 
    ? normalizedRoot 
    : normalizedRoot + path.sep;
  
  // Check if path starts with the permitted root (with trailing separator)
  // Also check exact match for the root itself
  if (!resolvedPath.startsWith(rootWithSeparator) && resolvedPath !== normalizedRoot) {
    throw new Error('Access denied: Path traversal detected.');
  }
  
  // Resolve symlinks to prevent symlink attacks
  const realPath = await fs.realpath(resolvedPath).catch(() => {
    // File doesn't exist yet (e.g., for write operations)
    // Return the resolved path as-is, existence will be checked later
    return resolvedPath;
  });
  
  // Validate the real path is still within permitted roots
  for (const permittedRoot of permittedRoots) {
    const permittedWithSeparator = permittedRoot.endsWith(path.sep) 
      ? permittedRoot 
      : permittedRoot + path.sep;
    
    if (realPath.startsWith(permittedWithSeparator) || realPath === permittedRoot) {
      return realPath;
    }
  }
  
  throw new Error('Access denied: Path outside permitted directories.');
}

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.bmp': 'image/bmp', '.avif': 'image/avif',
  '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
};

router.get('/raw', async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath) return res.status(400).json({ error: 'Path required' });
  try {
    const fullPath = await getSecurePath(filePath as string, permittedRoots[0]);
    const data = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(data);
  } catch (error: any) {
    if (error.message.includes('Access denied')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: 'Failed to read file' });
  }
});

router.get('/read', async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath) return res.status(400).json({ error: 'Path required' });
  try {
    const fullPath = await getSecurePath(filePath as string, permittedRoots[0]);
    const content = await fs.readFile(fullPath, 'utf-8');
    res.json({ content });
  } catch (error: any) {
    if (error.message.includes('Access denied')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: 'Failed to read file' });
  }
});

router.post('/write', async (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'Path required' });
  try {
    const fullPath = await getSecurePath(filePath, permittedRoots[0]);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
    res.json({ status: 'success' });
  } catch (error: any) {
    if (error.message.includes('Access denied')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.status(500).json({ error: 'Failed to write file' });
  }
});

router.post('/shell', async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Command required' });
  try {
    const { toolService } = await import('../services/toolService');
    const result = await toolService.executeTool('run_shell', { command });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;