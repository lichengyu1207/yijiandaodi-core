import axios from 'axios';

const WORKFLOW_API_BASE = '/api/workflow';

const workflowApi = axios.create({
  baseURL: WORKFLOW_API_BASE,
  timeout: 30000,
});

workflowApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

workflowApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('[Workflow API] Error:', error);
    return Promise.reject(error);
  }
);

export interface WorkflowNodeData {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    title?: string;
    desc?: string;
    [key: string]: any;
  };
}

export interface WorkflowEdgeData {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: {
    label?: string;
    condition_data?: any;
  };
}

export interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  workflow_type: 'chatflow' | 'workflow' | 'agent' | 'custom';
  status: 'draft' | 'published' | 'archived' | 'disabled';
  version: number;
  icon: string;
  icon_background: string;
  graph_data: any;
  environment_variables: any[];
  is_template: boolean;
  template_category: string;
  use_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  nodes?: WorkflowNodeItem[];
  edges?: WorkflowEdgeItem[];
}

export interface WorkflowNodeItem {
  id: string;
  node_id: string;
  node_type: string;
  title: string;
  desc: string;
  position_x: number;
  position_y: number;
  config_data: any;
  sort_order: number;
}

export interface WorkflowEdgeItem {
  id: string;
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string;
  target_handle: string;
  condition_data: any;
  label: string;
}

export interface WorkflowExecutionItem {
  id: string;
  workflow: string;
  workflow_name: string;
  status: 'running' | 'succeeded' | 'failed' | 'stopped' | 'timeout';
  inputs: any;
  outputs: any;
  error_message: string;
  total_tokens: number;
  total_steps: number;
  elapsed_time_ms: number;
  started_at: string;
  finished_at: string | null;
}

export interface WorkflowTemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
  cover_image: string;
  icon: string;
  icon_color: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  use_count: number;
  rating: number;
  is_featured: boolean;
  base_workflow_id: string;
  workflow_type: string;
  node_count: number;
}

export const getWorkflows = (params?: { type?: string; is_template?: string }) =>
  workflowApi.get('/workflows/', { params });

export const getWorkflowDetail = (id: string) =>
  workflowApi.get(`/workflows/${id}/`);

export const saveWorkflowGraph = (data: {
  workflow_id?: string;
  create_new?: boolean;
  name?: string;
  workflow_type?: string;
  description?: string;
  nodes: WorkflowNodeData[];
  edges: WorkflowEdgeData[];
  graph_data?: any;
}) => workflowApi.post('/workflows/save-graph/', data);

export const publishWorkflow = (id: string) =>
  workflowApi.post(`/workflows/${id}/publish/`);

export const executeWorkflow = (id: string, inputs: any = {}) =>
  workflowApi.post(`/workflows/${id}/execute/`, { inputs });

export const duplicateWorkflow = (sourceId: string, newName?: string) =>
  workflowApi.post('/workflows/duplicate/', { source_workflow_id: sourceId, new_name: newName });

export const getWorkflowTemplates = (params?: { category?: string; difficulty?: string }) =>
  workflowApi.get('/workflows/templates/', { params });

export const getExecutions = () =>
  workflowApi.get('/executions/');

export const stopExecution = (id: string) =>
  workflowApi.post(`/executions/${id}/stop/`);

// Attach convenience methods to the instance for backward compatibility
// @ts-expect-error extending axios instance
workflowApi.getWorkflowDetail = getWorkflowDetail;
// @ts-expect-error extending axios instance
workflowApi.duplicateWorkflow = duplicateWorkflow;

export default workflowApi;
