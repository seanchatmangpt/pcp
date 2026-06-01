import { blueprints, CRUDWithAISearchAndSync } from '../index';

describe('Compositional Blueprints', () => {
  it('should have the crud-ai-sync blueprint registered', () => {
    expect(blueprints['crud-ai-sync']).toBeDefined();
    expect(blueprints['crud-ai-sync'].name).toBe('crud-ai-sync');
  });

  describe('CRUDWithAISearchAndSync', () => {
    it('should generate all required files with correct paths', () => {
      const name = 'Task';
      const files = CRUDWithAISearchAndSync.generate(name);

      const paths = files.map((f) => f.path);
      expect(paths).toContain('src/types/semantic/Task.ts');
      expect(paths).toContain('src/hooks/useTask.ts');
      expect(paths).toContain('src/components/TaskCard.tsx');
      expect(paths).toContain('src/sync/TaskSyncHandler.ts');
      expect(paths).toContain('src/capabilities/task-search.ts');
      expect(paths).toContain('src/screens/TaskCompositionScreen.tsx');
    });

    it('should include the name in the generated content', () => {
      const name = 'Event';
      const files = CRUDWithAISearchAndSync.generate(name);

      files.forEach((file) => {
        expect(file.content).toContain('Event');
      });
    });

    it('should generate valid-looking template content', () => {
      const name = 'Profile';
      const files = CRUDWithAISearchAndSync.generate(name);

      const screenFile = files.find((f) => f.path.endsWith('ProfileCompositionScreen.tsx'));
      expect(screenFile?.content).toContain('export const ProfileCompositionScreen');
      expect(screenFile?.content).toContain('useProfile');
      expect(screenFile?.content).toContain('ProfileCard');
      expect(screenFile?.content).toContain('ProfileSearchCapability');
    });
  });
});
