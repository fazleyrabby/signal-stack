import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { DATABASE_CONNECTION } from '../database/database.module';
import { BackupService } from '../database/backup.service';

describe('AdminService', () => {
  let service: AdminService;
  let db: any;
  let backupService: BackupService;

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: DATABASE_CONNECTION, useValue: db },
        { provide: BackupService, useValue: { triggerManualBackup: jest.fn() } },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    backupService = module.get<BackupService>(BackupService);
  });

  describe('Categories', () => {
    it('getCategories should return all categories', async () => {
      db.orderBy.mockResolvedValue([{ slug: 'test' }]);
      const result = await service.getCategories();
      expect(result).toHaveLength(1);
      expect(db.select).toHaveBeenCalled();
    });

    it('createCategory should insert and return', async () => {
      const cat = { slug: 'new', name: 'New' };
      db.returning.mockResolvedValue([cat]);
      const result = await service.createCategory(cat as any);
      expect(result).toEqual(cat);
      expect(db.insert).toHaveBeenCalled();
    });

    it('updateCategory should update and return', async () => {
        db.returning.mockResolvedValue([{ slug: 'test' }]);
        await service.updateCategory('test', { name: 'Updated' });
        expect(db.update).toHaveBeenCalled();
    });

    it('deleteCategory should delete and return', async () => {
        db.returning.mockResolvedValue([{ slug: 'test' }]);
        await service.deleteCategory('test');
        expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('Sources', () => {
      it('getSources should return all sources', async () => {
        db.orderBy.mockResolvedValue([]);
        await service.getSources();
        expect(db.select).toHaveBeenCalled();
      });

      it('createSource should insert', async () => {
        db.returning.mockResolvedValue([{ id: '1' }]);
        await service.createSource({ name: 'src' } as any);
        expect(db.insert).toHaveBeenCalled();
      });
  });

  describe('AI Maintenance', () => {
    it('getFailedAISignals should call select', async () => {
      db.limit.mockResolvedValue([]);
      await service.getFailedAISignals();
      expect(db.select).toHaveBeenCalled();
    });

    it('resetBoilerplateSignals should update signals', async () => {
        db.returning.mockResolvedValue([]);
        await service.resetBoilerplateSignals();
        expect(db.update).toHaveBeenCalled();
    });
  });

  it('triggerBackup should call backupService', async () => {
      await service.triggerBackup();
      expect(backupService.triggerManualBackup).toHaveBeenCalled();
  });
});
