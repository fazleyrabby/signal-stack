import { Test, TestingModule } from '@nestjs/testing';
import { SignalsRepository } from './signals.repository';
import { DATABASE_CONNECTION } from '../database/database.module';
import { signals } from '../database/schema';

describe('SignalsRepository', () => {
  let repository: SignalsRepository;
  let db: any;

  beforeEach(async () => {
    db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignalsRepository,
        { provide: DATABASE_CONNECTION, useValue: db },
      ],
    }).compile();

    repository = module.get<SignalsRepository>(SignalsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hashExists', () => {
    it('should return true if hash exists', async () => {
      db.limit.mockResolvedValue([{ hash: 'test-hash' }]);
      const result = await repository.hashExists('test-hash');
      expect(result).toBe(true);
    });

    it('should return false if hash does not exist', async () => {
      db.limit.mockResolvedValue([]);
      const result = await repository.hashExists('new-hash');
      expect(result).toBe(false);
    });
  });

  describe('insert', () => {
    it('should insert and return the inserted signal', async () => {
      const mockData: any = { hash: 'test' };
      db.returning.mockResolvedValue([mockData]);

      const result = await repository.insert(mockData);

      expect(result).toEqual(mockData);
      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith(mockData);
    });

    it('should return null on unique constraint violation (code 23505)', async () => {
      const error: any = new Error('Duplicate');
      error.code = '23505';
      db.returning.mockRejectedValue(error);

      const result = await repository.insert({ hash: 'dup' } as any);

      expect(result).toBeNull();
    });

    it('should throw other errors', async () => {
      const error = new Error('Other');
      db.returning.mockRejectedValue(error);

      await expect(repository.insert({} as any)).rejects.toThrow('Other');
    });
  });

  describe('findAll', () => {
    it('should return data and total', async () => {
      // Mock chain for data
      const mockDataChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([{ id: 1 }]),
      };
      
      // Mock chain for count
      const mockCountChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ count: 10 }]),
      };

      db.select.mockReturnValueOnce(mockDataChain).mockReturnValueOnce(mockCountChain);

      const result = await repository.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(10);
    });

    it('should apply filters', async () => {
        const mockDataChain = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          offset: jest.fn().mockResolvedValue([]),
        };
        const mockCountChain = {
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue([{ count: 0 }]),
        };
  
        db.select.mockReturnValueOnce(mockDataChain).mockReturnValueOnce(mockCountChain);
  
        await repository.findAll({ 
            page: 1, 
            limit: 10, 
            severity: 'high',
            source: 'test',
            categoryId: 'cat',
            countryCode: 'US',
            search: 'query',
            minScore: 5
        });
  
        expect(mockDataChain.where).toHaveBeenCalled();
        expect(mockCountChain.where).toHaveBeenCalled();
      });
  });

  describe('getStats', () => {
    it('should return formatted stats', async () => {
      db.select.mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ count: 5, source: 'test' }]),
      });

      const stats = await repository.getStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('high');
      expect(stats).toHaveProperty('topSource');
    });
  });
});
