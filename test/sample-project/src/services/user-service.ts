import { Logger } from "../utils/logger"
import { User } from "../models/user"

export class UserService {
  constructor(private logger: Logger) {}

  async getAll(): Promise<User[]> {
    this.logger.info("Fetching all users")
    return [
      { id: "1", name: "Alice", email: "alice@example.com" },
      { id: "2", name: "Bob", email: "bob@example.com" },
    ]
  }

  async getById(id: string): Promise<User | null> {
    this.logger.info(`Fetching user ${id}`)
    const users = await this.getAll()
    return users.find(u => u.id === id) || null
  }
}
