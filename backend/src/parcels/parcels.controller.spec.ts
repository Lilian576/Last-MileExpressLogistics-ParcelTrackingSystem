import { Test, TestingModule } from '@nestjs/testing';
import { ParcelsController } from './parcels.controller';
import { ParcelsService } from './parcels.service';

describe('ParcelsController', () => {
  let controller: ParcelsController;

  const mockParcelsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParcelsController],
      providers: [
        { provide: ParcelsService, useValue: mockParcelsService },
      ],
    }).compile();

    controller = module.get<ParcelsController>(ParcelsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});