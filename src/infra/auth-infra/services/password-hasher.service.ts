import { Injectable } from '@nestjs/common'
import { HashService } from '../ports/hash.service'
// import * as bcrypt from 'bcrypt'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class PasswordHasher implements HashService {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }
}
