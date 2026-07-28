import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join, existsSync, mkdirSync } from 'path';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

const uploadDir = join(__dirname, '../../uploads');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dateFolder = new Date().toISOString().split('T')[0];
    const finalDir = join(uploadDir, dateFolder);
    if (!existsSync(finalDir)) {
      mkdirSync(finalDir, { recursive: true });
    }
    cb(null, finalDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop();
    cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'video/mp4',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`));
    }
  }
});

router.post('/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的文件' });
    }

    const fileUrl = `/uploads/${req.file.destination.split('uploads')[1]}/${req.file.filename}`;

    logger.info(`文件上传成功: ${req.file.originalname}`);

    res.json({
      success: true,
      message: '文件上传成功',
      data: {
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    logger.error('文件上传失败:', error);
    res.status(500).json({ success: false, message: '文件上传失败', error: error.message });
  }
});

router.post('/file', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要上传的文件' });
    }

    const files = req.files.map(file => ({
      url: `/uploads/${file.destination.split('uploads')[1]}/${file.filename}`,
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    }));

    logger.info(`批量上传成功: ${files.length} 个文件`);

    res.json({
      success: true,
      message: `成功上传 ${files.length} 个文件`,
      data: files
    });
  } catch (error) {
    logger.error('批量上传失败:', error);
    res.status(500).json({ success: false, message: '批量上传失败', error: error.message });
  }
});

export { uploadRouter as router };
