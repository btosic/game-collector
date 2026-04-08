import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async create(
    email: string,
    username: string,
    password: string,
  ): Promise<User> {
    const existing = await this.usersRepo.findOne({
      where: [{ email }, { username }],
    });
    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = this.usersRepo.create({ email, username, password: hashed });
    return this.usersRepo.save(user);
  }

  async findOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
