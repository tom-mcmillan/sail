import { ContainerCreateOptions } from 'dockerode';

export interface DockerSecurityConfig {
  memoryLimit: number;
  cpuQuota: number;
  cpuPeriod: number;
  pidsLimit: number;
  readOnlyRootfs: boolean;
  dropAllCapabilities: boolean;
  allowPrivilegeEscalation: boolean;
  networkMode: string;
  maxLogSize: string;
  maxLogFiles: string;
  user: string;
  workingDir: string;
}

export class DockerSecurityService {
  private static readonly DEFAULT_CONFIG: DockerSecurityConfig = {
    memoryLimit: 512 * 1024 * 1024, // 512MB
    cpuQuota: 50000, // 50% of one CPU core
    cpuPeriod: 100000,
    pidsLimit: 100,
    readOnlyRootfs: true,
    dropAllCapabilities: true,
    allowPrivilegeEscalation: false,
    networkMode: 'bridge',
    maxLogSize: '10m',
    maxLogFiles: '3',
    user: 'nodejs:nodejs',
    workingDir: '/app'
  };

  /**
   * Get Docker security configuration from environment variables
   */
  static getConfig(): DockerSecurityConfig {
    return {
      memoryLimit: parseInt(process.env.DOCKER_MEMORY_LIMIT || '536870912'), // 512MB default
      cpuQuota: parseInt(process.env.DOCKER_CPU_QUOTA || '50000'), // 50% default
      cpuPeriod: parseInt(process.env.DOCKER_CPU_PERIOD || '100000'),
      pidsLimit: parseInt(process.env.DOCKER_PIDS_LIMIT || '100'),
      readOnlyRootfs: process.env.DOCKER_READONLY_ROOTFS !== 'false',
      dropAllCapabilities: process.env.DOCKER_DROP_ALL_CAPS !== 'false',
      allowPrivilegeEscalation: process.env.DOCKER_ALLOW_PRIVILEGE_ESCALATION === 'true',
      networkMode: process.env.DOCKER_NETWORK_MODE || 'bridge',
      maxLogSize: process.env.DOCKER_MAX_LOG_SIZE || '10m',
      maxLogFiles: process.env.DOCKER_MAX_LOG_FILES || '3',
      user: process.env.DOCKER_USER || 'nodejs:nodejs',
      workingDir: process.env.DOCKER_WORKING_DIR || '/app'
    };
  }

  /**
   * Create secure container configuration
   */
  static createSecureContainerConfig(
    image: string,
    cmd: string[],
    env: string[],
    port: number,
    labels: Record<string, string> = {},
    binds: string[] = []
  ): ContainerCreateOptions {
    const config = this.getConfig();

    return {
      Image: image,
      Cmd: cmd,
      Env: env,
      ExposedPorts: {
        [`${port}/tcp`]: {}
      },
      User: config.user,
      WorkingDir: config.workingDir,
      HostConfig: {
        // Port bindings
        PortBindings: {
          [`${port}/tcp`]: [{ HostPort: port.toString() }]
        },
        
        // Restart policy
        RestartPolicy: {
          Name: 'unless-stopped'
        },
        
        // Resource limits
        Memory: config.memoryLimit,
        CpuQuota: config.cpuQuota,
        CpuPeriod: config.cpuPeriod,
        PidsLimit: config.pidsLimit,
        
        // Security policies
        ReadonlyRootfs: config.readOnlyRootfs,
        SecurityOpt: [
          `no-new-privileges:${!config.allowPrivilegeEscalation}`,
          'apparmor:docker-default'
        ],
        
        // Network security
        NetworkMode: config.networkMode,
        
        // Capability restrictions
        CapDrop: config.dropAllCapabilities ? ['ALL'] : [],
        CapAdd: ['NET_BIND_SERVICE'], // Only allow binding to privileged ports if needed
        
        // Temporary filesystem mounts for writable areas
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=100m',
          '/var/tmp': 'rw,noexec,nosuid,size=50m'
        },
        
        // Bind mounts
        Binds: binds,
        
        // Ulimits
        Ulimits: [
          { Name: 'nofile', Soft: 1024, Hard: 2048 }, // File descriptor limits
          { Name: 'nproc', Soft: 64, Hard: 128 } // Process limits
        ],
        
        // Logging configuration
        LogConfig: {
          Type: 'json-file',
          Config: {
            'max-size': config.maxLogSize,
            'max-file': config.maxLogFiles
          }
        }
      },
      
      // Labels for container management
      Labels: {
        ...labels,
        'sail.security.profile': 'restricted',
        'sail.created.at': new Date().toISOString()
      },
      
      // Additional security settings
      AttachStderr: false,
      AttachStdin: false,
      AttachStdout: false,
      OpenStdin: false,
      StdinOnce: false,
      Tty: false
    };
  }

  /**
   * Validate Docker security configuration
   */
  static validateConfig(config: DockerSecurityConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.memoryLimit < 128 * 1024 * 1024) {
      errors.push('Memory limit should be at least 128MB');
    }

    if (config.cpuQuota < 10000) {
      errors.push('CPU quota should be at least 10% (10000)');
    }

    if (config.pidsLimit < 10) {
      errors.push('Process limit should be at least 10');
    }

    if (!['bridge', 'host', 'none'].includes(config.networkMode)) {
      errors.push('Invalid network mode. Must be bridge, host, or none');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get security recommendations based on environment
   */
  static getSecurityRecommendations(): {
    production: DockerSecurityConfig;
    development: DockerSecurityConfig;
  } {
    return {
      production: {
        ...this.DEFAULT_CONFIG,
        memoryLimit: 256 * 1024 * 1024, // Lower memory for production
        cpuQuota: 25000, // Lower CPU for production
        pidsLimit: 50, // Lower process limit
        readOnlyRootfs: true,
        dropAllCapabilities: true,
        allowPrivilegeEscalation: false,
        networkMode: 'bridge'
      },
      development: {
        ...this.DEFAULT_CONFIG,
        memoryLimit: 1024 * 1024 * 1024, // Higher memory for development
        cpuQuota: 100000, // Full CPU for development
        pidsLimit: 200, // Higher process limit
        readOnlyRootfs: false, // Allow writes for development
        dropAllCapabilities: false, // More permissive for debugging
        allowPrivilegeEscalation: false,
        networkMode: 'bridge'
      }
    };
  }
}