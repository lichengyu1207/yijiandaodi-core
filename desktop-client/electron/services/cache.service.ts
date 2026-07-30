import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export class CacheService {
  private cacheDir: string
  private maxCacheSizeMB: number = 2048
  private metadataFile: string

  constructor(baseDir?: string) {
    this.cacheDir = baseDir || path.join(process.cwd(), '.cache')
    this.metadataFile = path.join(this.cacheDir, 'cache_metadata.json')
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true })
    
    const modelsDir = path.join(this.cacheDir, 'models')
    const resultsDir = path.join(this.cacheDir, 'results')
    
    await fs.mkdir(modelsDir, { recursive: true })
    await fs.mkdir(resultsDir, { recursive: true })

    const metadataExists = await this._fileExists(this.metadataFile)
    if (!metadataExists) {
      await fs.writeFile(
        this.metadataFile, 
        JSON.stringify({
          version: '1.0.0',
          created_at: new Date().toISOString(),
          total_cached: 0,
          last_cleanup: null
        }, null, 2)
      )
    }
  }

  async cacheModel(modelId: string, modelData: Buffer): Promise<string> {
    const hash = crypto.createHash('md5').update(modelId).digest('hex').slice(0, 12)
    const modelDir = path.join(this.cacheDir, 'models', hash)
    await fs.mkdir(modelDir, { recursive: true })
    
    const filePath = path.join(modelDir, 'model.bin')
    await fs.writeFile(filePath, modelData)
    
    const meta = {
      model_id: modelId,
      size_bytes: modelData.length,
      cached_at: new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      version: '1.0.0',
      hash: hash
    }
    await fs.writeFile(path.join(modelDir, 'metadata.json'), JSON.stringify(meta, null, 2))

    await this._updateGlobalMetadata()

    return filePath
  }

  async cacheTaskResult(taskId: string, result: object): Promise<void> {
    const resultDir = path.join(this.cacheDir, 'results')
    await fs.mkdir(resultDir, { recursive: true })
    
    const data = {
      task_id: taskId,
      result,
      cached_at: new Date().toISOString(),
      size_bytes: Buffer.byteLength(JSON.stringify(data), 'utf-8')
    }
    await fs.writeFile(path.join(resultDir, `${taskId}.json`), JSON.stringify(data, null, 2))

    await this._updateGlobalMetadata()
  }

  async getTaskResult(taskId: string): Promise<object | null> {
    const filePath = path.join(this.cacheDir, 'results', `${taskId}.json`)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)

      this._touchResult(taskId)

      return data.result
    } catch {
      return null
    }
  }

  async getModelPath(modelId: string): Promise<string | null> {
    const hash = crypto.createHash('md5').update(modelId).digest('hex').slice(0, 12)
    const modelDir = path.join(this.cacheDir, 'models', hash)
    const filePath = path.join(modelDir, 'model.bin')

    try {
      await fs.access(filePath)
      
      this._touchModel(hash)

      return filePath
    } catch {
      return null
    }
  }

  async getModelMetadata(modelId: string): Promise<object | null> {
    const hash = crypto.createHash('md5').update(modelId).digest('hex').slice(0, 12)
    const metaPath = path.join(this.cacheDir, 'models', hash, 'metadata.json')

    try {
      const content = await fs.readFile(metaPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  async cleanup(): Promise<{ freedBytes: number; deletedCount: number }> {
    let freedBytes = 0
    let deletedCount = 0

    try {
      const files = await this._getAllCachedFiles()
      const totalSize = files.reduce((sum, f) => sum + f.size, 0)
      
      if (totalSize <= this.maxCacheSizeMB * 1024 * 1024) {
        return { freedBytes: 0, deletedCount: 0 }
      }
      
      files.sort((a, b) => new Date(a.accessed).getTime() - new Date(b.accessed).getTime())
      
      for (const file of files) {
        if (totalSize - freedBytes <= this.maxCacheSizeMB * 1024 * 1024) break
        
        try {
          await fs.unlink(file.path)
          freedBytes += file.size
          deletedCount++

          const parentDir = path.dirname(file.path)
          try {
            const remainingFiles = await fs.readdir(parentDir)
            if (remainingFiles.length === 0) {
              await fs.rmdir(parentDir)
            }
          } catch {
            // 目录可能不为空或已被删除
          }
        } catch (unlinkError) {
          console.warn(`Failed to delete cache file: ${file.path}`, unlinkError)
        }
      }

      const metadata = await this._readGlobalMetadata()
      if (metadata) {
        metadata.last_cleanup = new Date().toISOString()
        await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2))
      }
    } catch (error) {
      console.error('Cache cleanup error:', error)
    }

    return { freedBytes, deletedCount }
  }

  async clearAll(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true })
      await this.initialize()
    } catch (error) {
      console.error('Failed to clear cache:', error)
      throw error
    }
  }

  async getCacheStats(): Promise<{
    totalSizeBytes: number
    modelCount: number
    resultCount: number
    oldestAccess: string | null
  }> {
    const files = await this._getAllCachedFiles()
    const totalSizeBytes = files.reduce((sum, f) => sum + f.size, 0)
    
    let modelCount = 0
    let resultCount = 0
    
    for (const file of files) {
      if (file.path.includes(path.join('models'))) {
        modelCount++
      } else if (file.path.includes(path.join('results'))) {
        resultCount++
      }
    }

    const sortedByAccess = [...files].sort(
      (a, b) => new Date(a.accessed).getTime() - new Date(b.accessed).getTime()
    )
    const oldestAccess = sortedByAccess.length > 0 ? sortedByAccess[0].accessed : null

    return {
      totalSizeBytes,
      modelCount,
      resultCount,
      oldestAccess
    }
  }

  private async _getAllCachedFiles(): Promise<Array<{ path: string; size: number; accessed: string }>> {
    const results: Array<{ path: string; size: number; accessed: string }> = []

    try {
      const scanDir = async (dirPath: string): Promise<void> => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name)

          if (entry.isDirectory()) {
            await scanDir(fullPath)
          } else if (entry.isFile() && entry.name !== 'metadata.json' && entry.name !== 'cache_metadata.json') {
            try {
              const stat = await fs.stat(fullPath)
              
              let lastAccessed = stat.atime.toISOString()
              
              const dirName = path.basename(path.dirname(fullPath))
              if (dirName.length === 12 && /^[a-f0-9]{12}$/.test(dirName)) {
                const metaPath = path.join(path.dirname(fullPath), 'metadata.json')
                try {
                  const metaContent = await fs.readFile(metaPath, 'utf-8')
                  const meta = JSON.parse(metaContent)
                  if (meta.last_accessed) {
                    lastAccessed = meta.last_accessed
                  }
                } catch {
                  // 元数据文件不存在或无法读取
                }
              } else if (fullPath.endsWith('.json')) {
                try {
                  const content = await fs.readFile(fullPath, 'utf-8')
                  const data = JSON.parse(content)
                  if (data.cached_at) {
                    lastAccessed = data.cached_at
                  }
                } catch {
                  // 无法解析JSON
                }
              }

              results.push({
                path: fullPath,
                size: stat.size,
                accessed: lastAccessed
              })
            } catch (statError) {
              console.warn(`Failed to stat file: ${fullPath}`, statError)
            }
          }
        }
      }

      await scanDir(this.cacheDir)
    } catch (error) {
      console.error('Error scanning cache directory:', error)
    }

    return results
  }

  private async _fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private async _readGlobalMetadata(): Promise<object | null> {
    try {
      const content = await fs.readFile(this.metadataFile, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  private async _updateGlobalMetadata(): Promise<void> {
    try {
      const stats = await this.getCacheStats()
      const metadata = await this._readGlobalMetadata() || {}
      
      await fs.writeFile(
        this.metadataFile,
        JSON.stringify({
          ...metadata,
          total_cached: stats.modelCount + stats.resultCount,
          total_size_bytes: stats.totalSizeBytes,
          last_updated: new Date().toISOString()
        }, null, 2)
      )
    } catch (error) {
      console.warn('Failed to update global metadata:', error)
    }
  }

  private async _touchModel(hash: string): Promise<void> {
    const metaPath = path.join(this.cacheDir, 'models', hash, 'metadata.json')
    try {
      const content = await fs.readFile(metaPath, 'utf-8')
      const meta = JSON.parse(content)
      meta.last_accessed = new Date().toISOString()
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2))
    } catch {
      // 忽略更新失败
    }
  }

  private async _touchResult(taskId: string): Promise<void> {
    const filePath = path.join(this.cacheDir, 'results', `${taskId}.json`)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      data.cached_at = new Date().toISOString()
      await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    } catch {
      // 忽略更新失败
    }
  }
}

export default CacheService
