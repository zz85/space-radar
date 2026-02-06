/**
 * Sunburst Visualization for Space Radar Electrobun POC
 * 
 * Canvas-based sunburst chart implementation.
 * This demonstrates how the visualization would work in Electrobun.
 */

import type { FileNode } from '../bun/scanner';

interface SunburstOptions {
  width: number;
  height: number;
  centerX?: number;
  centerY?: number;
  innerRadius?: number;
  colorScheme?: string[];
}

interface Arc {
  node: FileNode;
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  color: string;
  depth: number;
}

export class SunburstChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: Required<SunburstOptions>;
  private arcs: Arc[] = [];
  private rootNode: FileNode | null = null;
  private maxDepth = 0;
  private hoveredArc: Arc | null = null;

  // Default color scheme (Seaborn Pastel)
  private static DEFAULT_COLORS = [
    '#a1c9f4', '#ffb482', '#8de5a1', '#ff9f9b',
    '#d0bbff', '#debb9b', '#fab0e4', '#cfcfcf',
    '#fffea3', '#b9f2f0'
  ];

  constructor(canvas: HTMLCanvasElement, options: SunburstOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    this.ctx = ctx;

    this.options = {
      width: options.width,
      height: options.height,
      centerX: options.centerX ?? options.width / 2,
      centerY: options.centerY ?? options.height / 2,
      innerRadius: options.innerRadius ?? Math.min(options.width, options.height) * 0.1,
      colorScheme: options.colorScheme ?? SunburstChart.DEFAULT_COLORS,
    };

    // Set canvas size
    canvas.width = this.options.width;
    canvas.height = this.options.height;

    // Add mouse interaction
    this.setupInteraction();
  }

  /**
   * Set up mouse hover interaction
   */
  private setupInteraction() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const dx = x - this.options.centerX;
      const dy = y - this.options.centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Find arc under cursor
      let found: Arc | null = null;
      for (const arc of this.arcs) {
        if (distance >= arc.innerRadius && distance <= arc.outerRadius) {
          let arcAngle = angle;
          if (arcAngle < 0) arcAngle += Math.PI * 2;
          if (arcAngle >= arc.startAngle && arcAngle <= arc.endAngle) {
            found = arc;
            break;
          }
        }
      }

      if (found !== this.hoveredArc) {
        this.hoveredArc = found;
        this.render();
        
        // Update cursor
        this.canvas.style.cursor = found ? 'pointer' : 'default';
        
        // Show tooltip (in a real app)
        if (found) {
          const size = this.formatBytes(found.node.size);
          console.log(`Hover: ${found.node.name} (${size})`);
        }
      }
    });
  }

  /**
   * Render the sunburst chart from a file tree
   */
  public setData(root: FileNode) {
    this.rootNode = root;
    this.arcs = [];
    this.maxDepth = this.calculateMaxDepth(root);
    
    // Calculate arcs
    this.calculateArcs(root, 0, Math.PI * 2, 0);
    
    // Render
    this.render();
  }

  /**
   * Calculate maximum depth of tree
   */
  private calculateMaxDepth(node: FileNode, depth = 0): number {
    if (!node.children || node.children.length === 0) {
      return depth;
    }
    return Math.max(...node.children.map(child => this.calculateMaxDepth(child, depth + 1)));
  }

  /**
   * Calculate arcs for all nodes recursively
   */
  private calculateArcs(
    node: FileNode,
    startAngle: number,
    endAngle: number,
    depth: number
  ) {
    const maxRadius = Math.min(this.options.width, this.options.height) / 2;
    const radiusRange = maxRadius - this.options.innerRadius;
    const radiusPerLevel = radiusRange / (this.maxDepth + 1);

    const innerRadius = this.options.innerRadius + depth * radiusPerLevel;
    const outerRadius = innerRadius + radiusPerLevel;

    // Get color for this node
    const color = this.options.colorScheme[depth % this.options.colorScheme.length];

    // Create arc for this node
    const arc: Arc = {
      node,
      startAngle,
      endAngle,
      innerRadius,
      outerRadius,
      color,
      depth,
    };
    this.arcs.push(arc);

    // Recursively create arcs for children
    if (node.children && node.children.length > 0) {
      const totalSize = node.size;
      let currentAngle = startAngle;

      for (const child of node.children) {
        const angleSize = ((endAngle - startAngle) * child.size) / totalSize;
        const childEndAngle = currentAngle + angleSize;

        this.calculateArcs(child, currentAngle, childEndAngle, depth + 1);

        currentAngle = childEndAngle;
      }
    }
  }

  /**
   * Render the sunburst chart
   */
  private render() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.options.width, this.options.height);

    // Draw all arcs
    for (const arc of this.arcs) {
      this.drawArc(arc, arc === this.hoveredArc);
    }

    // Draw center circle
    this.ctx.beginPath();
    this.ctx.arc(this.options.centerX, this.options.centerY, this.options.innerRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();
    this.ctx.strokeStyle = '#cccccc';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw center text
    if (this.rootNode) {
      this.ctx.fillStyle = '#333333';
      this.ctx.font = 'bold 16px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const size = this.formatBytes(this.rootNode.size);
      this.ctx.fillText(size, this.options.centerX, this.options.centerY);
    }
  }

  /**
   * Draw a single arc
   */
  private drawArc(arc: Arc, isHovered: boolean) {
    this.ctx.beginPath();
    this.ctx.arc(
      this.options.centerX,
      this.options.centerY,
      arc.outerRadius,
      arc.startAngle,
      arc.endAngle
    );
    this.ctx.arc(
      this.options.centerX,
      this.options.centerY,
      arc.innerRadius,
      arc.endAngle,
      arc.startAngle,
      true
    );
    this.ctx.closePath();

    // Fill
    this.ctx.fillStyle = arc.color;
    if (isHovered) {
      // Brighten on hover
      this.ctx.globalAlpha = 0.8;
    } else {
      this.ctx.globalAlpha = 1.0;
    }
    this.ctx.fill();
    this.ctx.globalAlpha = 1.0;

    // Stroke
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
