import { UserService } from "./services/user-service"
import { Logger } from "./utils/logger"

const logger = new Logger("main")
const userService = new UserService(logger)

export async function main() {
  logger.info("Starting application")
  const users = await userService.getAll()
  logger.info(`Found ${users.length} users`)
  return users
}

main()
