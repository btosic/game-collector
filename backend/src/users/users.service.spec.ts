import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let repo: ReturnType<typeof mockRepo>;

  const mockUser: Partial<User> = {
    id: 'user-uuid',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashed-password',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));
  });

  describe('create', () => {
    it('hashes the password and persists the user', async () => {
      repo.findOne.mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);
      repo.create.mockReturnValue(mockUser);
      repo.save.mockResolvedValue(mockUser);

      const result = await service.create('test@example.com', 'testuser', 'plaintext');

      expect(bcrypt.hash).toHaveBeenCalledWith('plaintext', 12);
      expect(repo.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('throws ConflictException when email or username is already taken', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      await expect(
        service.create('test@example.com', 'testuser', 'password'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOrFail', () => {
    it('returns the user when found', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      const result = await service.findOrFail('user-uuid');

      expect(result).toEqual(mockUser);
    });

    it('throws NotFoundException when user does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOrFail('nonexistent-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('delegates to the repository', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(result).toEqual(mockUser);
    });

    it('returns null when email is not found', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nobody@example.com');

      expect(result).toBeNull();
    });
  });
});
