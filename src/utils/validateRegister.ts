import { UserInput } from 'src/resolvers/UserInput'

export const validateRegister = (options: UserInput) => {
  const { username, password, email } = options
  if (username.length <= 2) {
    return [
      {
        field: 'username',
        message: 'username is too short',
      },
    ]
  }

  if (username.includes('@')) {
    return [
      {
        field: 'username',
        message: "username cannot include a '@'' symbol",
      },
    ]
  }

  if (password.length <= 2) {
    return [
      {
        field: 'password',
        message: 'password too short',
      },
    ]
  }

  if (!email.includes('@')) {
    return [
      {
        field: 'email',
        message: 'invalid email address',
      },
    ]
  }

  return null
}
