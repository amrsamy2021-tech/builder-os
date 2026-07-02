import { create } from "zustand";
import { commands } from "@/lib/tauri-commands";
import type { ProductBrain, Project } from "@/types/product-brain";
import { createEmptyProductBrain } from "@/types/product-brain";

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  productBrains: Record<string, ProductBrain>;
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  createProject: (
    name: string,
    folderPath: string,
    idea: string,
    extras?: Partial<ProductBrain>,
  ) => Promise<Project>;
  setActiveProject: (id: string | null) => void;
  loadProductBrain: (projectId: string) => Promise<void>;
  updateProductBrain: (projectId: string, data: ProductBrain) => Promise<void>;
  getActiveProject: () => Project | null;
  getActiveProductBrain: () => ProductBrain | null;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  productBrains: {},
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await commands.getProjects();
      set({ projects, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  createProject: async (name, folderPath, idea, extras = {}) => {
    set({ loading: true, error: null });
    try {
      const id = crypto.randomUUID();
      const productBrain: ProductBrain = {
        ...createEmptyProductBrain(id, name, idea),
        ...extras,
      };
      const project = await commands.createProject({
        name,
        folderPath,
        productBrain,
      });
      await commands.initWorkflowStages(project.id);
      await commands.scaffoldProject(folderPath, productBrain);
      await commands.logActivity(project.id, "project_created", { name });
      set((state) => ({
        projects: [...state.projects, project],
        productBrains: { ...state.productBrains, [project.id]: productBrain },
        activeProjectId: project.id,
        loading: false,
      }));
      return project;
    } catch (e) {
      set({ error: String(e), loading: false });
      throw e;
    }
  },

  setActiveProject: (id) => set({ activeProjectId: id }),

  loadProductBrain: async (projectId) => {
    try {
      const brain = await commands.getProductBrain(projectId);
      set((state) => ({
        productBrains: { ...state.productBrains, [projectId]: brain },
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  updateProductBrain: async (projectId, data) => {
    const updated = { ...data, updatedAt: new Date().toISOString() };
    await commands.updateProductBrain(projectId, updated);
    set((state) => ({
      productBrains: { ...state.productBrains, [projectId]: updated },
    }));
  },

  getActiveProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find((p) => p.id === activeProjectId) ?? null;
  },

  getActiveProductBrain: () => {
    const { productBrains, activeProjectId } = get();
    return activeProjectId ? productBrains[activeProjectId] ?? null : null;
  },
}));
