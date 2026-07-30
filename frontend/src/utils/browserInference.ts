import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = true;
env.useBrowserCache = true;

export interface InferenceResult {
  label: string;
  score: number;
  raw: any;
}

export interface InferenceStatus {
  loading: boolean;
  progress: number;
  modelLoaded: boolean;
  modelName: string;
  error: string | null;
}

let classifierPipeline: any = null;
let nerPipeline: any = null;
let zeroShotPipeline: any = null;

export async function loadTextClassifier(
  modelName: string = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  onProgress?: (progress: number) => void
): Promise<void> {
  if (classifierPipeline) return;

  try {
    classifierPipeline = await pipeline('sentiment-analysis', modelName, {
      progress_callback: (progress: any) => {
        if (onProgress && progress.status === 'downloading') {
          onProgress(Math.round((progress.progress || 0) * 100));
        } else if (onProgress && progress.status === 'ready') {
          onProgress(100);
        }
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error('模型加载失败: ' + message);
  }
}

export async function classifyText(text: string): Promise<InferenceResult[]> {
  if (!classifierPipeline) {
    throw new Error('分类模型未加载，请先调用 loadTextClassifier()');
  }

  if (!text || typeof text !== 'string') {
    throw new Error('输入文本必须是非空字符串');
  }

  try {
    const results = await classifierPipeline(text);
    return results.map((r: any) => ({
      label: r.label,
      score: Math.round(r.score * 10000) / 10000,
      raw: r,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error('文本分类推理失败: ' + message);
  }
}

export async function loadNerModel(
  modelName: string = 'Xenova/ner-pipeline',
  onProgress?: (progress: number) => void
): Promise<void> {
  if (nerPipeline) return;

  try {
    nerPipeline = await pipeline('ner', modelName, {
      progress_callback: (p: any) => {
        if (onProgress) {
          onProgress(p.status === 'downloading' ? Math.round((p.progress || 0) * 100) : 100);
        }
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error('NER模型加载失败: ' + message);
  }
}

export async function extractEntities(text: string): Promise<Array<{
  word: string;
  entity_group: string;
  start: number;
  end: number;
  score: number;
}>> {
  if (!nerPipeline) {
    throw new Error('NER模型未加载，请先调用 loadNerModel()');
  }

  if (!text || typeof text !== 'string') {
    throw new Error('输入文本必须是非空字符串');
  }

  try {
    const results = await nerPipeline(text);
    return results.map((r: any) => ({
      word: r.word,
      entity_group: r.entity_group ?? r.entity,
      start: r.start,
      end: r.end,
      score: Math.round(r.score * 10000) / 10000,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error('实体抽取推理失败: ' + message);
  }
}

export async function loadZeroShot(
  onProgress?: (progress: number) => void
): Promise<void> {
  if (zeroShotPipeline) return;

  try {
    zeroShotPipeline = await pipeline(
      'zero-shot-classification',
      'Xenova/MobileBERT-zero-shot-coarse-NLI',
      {
        progress_callback: (p: any) => {
          if (onProgress) {
            onProgress(p.status === 'downloading' ? Math.round((p.progress || 0) * 100) : 100);
          }
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error('零样本模型加载失败: ' + message);
  }
}

export async function zeroShotClassify(
  text: string,
  labels: string[]
): Promise<InferenceResult[]> {
  if (!zeroShotPipeline) {
    throw new Error('零样本模型未加载，请先调用 loadZeroShot()');
  }

  if (!text || typeof text !== 'string') {
    throw new Error('输入文本必须是非空字符串');
  }

  if (!Array.isArray(labels) || labels.length === 0) {
    throw new Error('labels 必须是非空字符串数组');
  }

  try {
    const results = await zeroShotPipeline(text, labels);
    return results.map((r: any) => ({
      label: r.label,
      score: Math.round(r.score * 10000) / 10000,
      raw: r,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error('零样本分类推理失败: ' + message);
  }
}

export function disposeAllPipelines(): void {
  if (classifierPipeline) {
    try {
      if (typeof classifierPipeline.dispose === 'function') {
        classifierPipeline.dispose();
      }
    } catch {}
    classifierPipeline = null;
  }

  if (nerPipeline) {
    try {
      if (typeof nerPipeline.dispose === 'function') {
        nerPipeline.dispose();
      }
    } catch {}
    nerPipeline = null;
  }

  if (zeroShotPipeline) {
    try {
      if (typeof zeroShotPipeline.dispose === 'function') {
        zeroShotPipeline.dispose();
      }
    } catch {}
    zeroShotPipeline = null;
  }
}

export function getInferenceStatus(): InferenceStatus {
  return {
    loading: !classifierPipeline && !nerPipeline && !zeroShotPipeline,
    progress: classifierPipeline || nerPipeline || zeroShotPipeline ? 100 : 0,
    modelLoaded: !!(classifierPipeline || nerPipeline || zeroShotPipeline),
    modelName: [
      classifierPipeline && 'text-classifier',
      nerPipeline && 'ner',
      zeroShotPipeline && 'zero-shot',
    ].filter(Boolean).join(', ') || '',
    error: null,
  };
}
