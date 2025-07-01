import { AdapterInfo } from './base/AdapterInfo';
import { LegacyKnowledgeStoreAdapter } from './base/AdapterBridge';

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  includePRs?: boolean;
  includeIssues?: boolean;
}

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  download_url?: string;
  content?: string;
}

export class GitHubAdapter implements LegacyKnowledgeStoreAdapter {
  public readonly storeType = 'github';
  public readonly displayName = 'GitHub Repository';
  public readonly description = 'Access GitHub repository files, issues, and pull requests';
  public readonly requiredConfig = ['token', 'owner', 'repo'];

  private config: GitHubConfig;
  private baseUrl = 'https://api.github.com';

  constructor(config: GitHubConfig) {
    this.config = {
      branch: 'main',
      includePRs: true,
      includeIssues: true,
      ...config
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const response = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}`);
      return { 
        healthy: true, 
        message: `Connected to ${response.full_name}` 
      };
    } catch (error: any) {
      return { 
        healthy: false, 
        message: `GitHub API error: ${error.message}` 
      };
    }
  }

  async searchContent(query: string, options?: any): Promise<any[]> {
    const results: any[] = [];

    try {
      // Search repository code
      const codeResults = await this.searchCode(query);
      results.push(...codeResults);

      // Search issues if enabled
      if (this.config.includeIssues) {
        const issueResults = await this.searchIssues(query);
        results.push(...issueResults);
      }

      // Search pull requests if enabled
      if (this.config.includePRs) {
        const prResults = await this.searchPullRequests(query);
        results.push(...prResults);
      }

      return results;
    } catch (error) {
      console.error('GitHub search error:', error);
      return [];
    }
  }

  async getFileContent(filePath: string): Promise<string> {
    try {
      const response = await this.makeRequest(
        `/repos/${this.config.owner}/${this.config.repo}/contents/${filePath}`,
        { ref: this.config.branch }
      );

      if (response.type === 'file') {
        return Buffer.from(response.content, 'base64').toString('utf-8');
      } else {
        throw new Error(`Path is not a file: ${filePath}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  async listFiles(options?: any): Promise<any[]> {
    try {
      const files = await this.getRepositoryTree();
      return files
        .filter((file: GitHubFile) => file.type === 'file')
        .map((file: GitHubFile) => ({
          name: file.name,
          path: file.path,
          size: file.size,
          type: this.getFileType(file.name),
          url: `https://github.com/${this.config.owner}/${this.config.repo}/blob/${this.config.branch}/${file.path}`,
          lastModified: null // Would need additional API call to get commit info
        }));
    } catch (error) {
      console.error('GitHub list files error:', error);
      return [];
    }
  }

  async getResourceContent(resourceId: string): Promise<any> {
    if (resourceId.startsWith('file:')) {
      const filePath = resourceId.replace('file:', '');
      const content = await this.getFileContent(filePath);
      return {
        content,
        mimeType: 'text/plain',
        uri: resourceId
      };
    } else if (resourceId.startsWith('issue:')) {
      const issueNumber = resourceId.replace('issue:', '');
      return await this.getIssue(issueNumber);
    } else if (resourceId.startsWith('pr:')) {
      const prNumber = resourceId.replace('pr:', '');
      return await this.getPullRequest(prNumber);
    }

    throw new Error(`Unknown resource type: ${resourceId}`);
  }

  async listResources(): Promise<any[]> {
    const resources: any[] = [];

    try {
      // Add file resources
      const files = await this.listFiles();
      resources.push(...files.map(file => ({
        uri: `file:${file.path}`,
        name: file.name,
        description: `File: ${file.path}`,
        mimeType: 'text/plain'
      })));

      // Add issue resources if enabled
      if (this.config.includeIssues) {
        const issues = await this.getRecentIssues();
        resources.push(...issues.map((issue: any) => ({
          uri: `issue:${issue.number}`,
          name: `Issue #${issue.number}: ${issue.title}`,
          description: issue.body?.substring(0, 200) + '...',
          mimeType: 'text/markdown'
        })));
      }

      return resources;
    } catch (error) {
      console.error('GitHub list resources error:', error);
      return [];
    }
  }

  async listTools(): Promise<any[]> {
    return [
      {
        name: 'search_code',
        description: 'Search for code in the repository',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            language: { type: 'string', description: 'Programming language filter' }
          },
          required: ['query']
        }
      },
      {
        name: 'get_file',
        description: 'Get the contents of a specific file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path in repository' }
          },
          required: ['path']
        }
      },
      {
        name: 'create_issue',
        description: 'Create a new issue',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Issue title' },
            body: { type: 'string', description: 'Issue description' },
            labels: { type: 'array', items: { type: 'string' }, description: 'Issue labels' }
          },
          required: ['title']
        }
      }
    ];
  }

  async callTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'search_code':
        return await this.searchCode(args.query, args.language);
      
      case 'get_file':
        const content = await this.getFileContent(args.path);
        return { path: args.path, content };
      
      case 'create_issue':
        return await this.createIssue(args.title, args.body, args.labels);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async listPrompts(): Promise<any[]> {
    return [
      {
        name: 'analyze_repo',
        description: 'Analyze repository structure and provide insights',
        arguments: []
      },
      {
        name: 'code_review',
        description: 'Review code changes and provide feedback',
        arguments: [
          { name: 'file_path', description: 'Path to file to review', required: true }
        ]
      }
    ];
  }

  async getPrompt(name: string, args?: any): Promise<any> {
    switch (name) {
      case 'analyze_repo':
        const files = await this.listFiles();
        const fileTypes = this.analyzeFileTypes(files);
        return {
          description: `Repository analysis for ${this.config.owner}/${this.config.repo}`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Analyze this repository structure:\n\nFile types: ${JSON.stringify(fileTypes, null, 2)}\nTotal files: ${files.length}`
              }
            }
          ]
        };
      
      case 'code_review':
        if (!args?.file_path) {
          throw new Error('file_path argument required for code_review prompt');
        }
        const content = await this.getFileContent(args.file_path);
        return {
          description: `Code review for ${args.file_path}`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please review this code file:\n\nFile: ${args.file_path}\n\`\`\`\n${content}\n\`\`\``
              }
            }
          ]
        };
      
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }

  getAdapterInfo(): AdapterInfo {
    return {
      storeType: this.storeType,
      displayName: this.displayName,
      description: this.description,
      requiredConfig: this.requiredConfig
    };
  }

  private async makeRequest(endpoint: string, params?: any): Promise<any> {
    const url = new URL(this.baseUrl + endpoint);
    if (params) {
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SailMCP/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private async searchCode(query: string, language?: string): Promise<any[]> {
    let searchQuery = `${query} repo:${this.config.owner}/${this.config.repo}`;
    if (language) {
      searchQuery += ` language:${language}`;
    }

    const response = await this.makeRequest('/search/code', { q: searchQuery });
    
    return response.items?.map((item: any) => ({
      title: item.name,
      content: item.text_matches?.[0]?.fragment || '',
      path: item.path,
      url: item.html_url,
      type: 'code',
      score: item.score
    })) || [];
  }

  private async searchIssues(query: string): Promise<any[]> {
    const searchQuery = `${query} repo:${this.config.owner}/${this.config.repo} is:issue`;
    const response = await this.makeRequest('/search/issues', { q: searchQuery });
    
    return response.items?.map((item: any) => ({
      title: item.title,
      content: item.body || '',
      url: item.html_url,
      type: 'issue',
      number: item.number,
      state: item.state,
      score: item.score
    })) || [];
  }

  private async searchPullRequests(query: string): Promise<any[]> {
    const searchQuery = `${query} repo:${this.config.owner}/${this.config.repo} is:pr`;
    const response = await this.makeRequest('/search/issues', { q: searchQuery });
    
    return response.items?.map((item: any) => ({
      title: item.title,
      content: item.body || '',
      url: item.html_url,
      type: 'pull_request',
      number: item.number,
      state: item.state,
      score: item.score
    })) || [];
  }

  private async getRepositoryTree(): Promise<GitHubFile[]> {
    const response = await this.makeRequest(
      `/repos/${this.config.owner}/${this.config.repo}/git/trees/${this.config.branch}`,
      { recursive: 1 }
    );
    return response.tree || [];
  }

  private async getIssue(number: string): Promise<any> {
    return await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/issues/${number}`);
  }

  private async getPullRequest(number: string): Promise<any> {
    return await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/pulls/${number}`);
  }

  private async getRecentIssues(): Promise<any[]> {
    const response = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/issues`, {
      state: 'all',
      per_page: 20,
      sort: 'updated'
    });
    return response || [];
  }

  private async createIssue(title: string, body?: string, labels?: string[]): Promise<any> {
    const issueData: any = { title };
    if (body) issueData.body = body;
    if (labels) issueData.labels = labels;

    const response = await fetch(`${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'SailMCP/1.0'
      },
      body: JSON.stringify(issueData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create issue: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private getFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const typeMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'md': 'markdown',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'html': 'html',
      'css': 'css',
      'go': 'go',
      'rs': 'rust',
      'java': 'java'
    };
    return typeMap[ext || ''] || 'text';
  }

  private analyzeFileTypes(files: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    files.forEach(file => {
      const type = file.type;
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }
}