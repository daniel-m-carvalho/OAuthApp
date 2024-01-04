# Google Tasks Web Application with GitHub Milestones Integration

This web application is designed to allow users to create tasks using the Google Tasks API [1] through the integration of GitHub project milestones [2]. Access to private GitHub projects is optional but highly valued.

## Application Requirements

- The application only accepts requests from authenticated users, except on the authentication route. Users are authenticated through the Google social identity provider using the OpenID Connect protocol [3, 4]. After user authentication, access to services is granted based on the user's role assigned by the security policy.

- **Access Control Policy:** The application uses the Role-Based Access Control (RBAC) model to manage three roles: free, premium, and admin. In the free role, users can only view their tasks. In the premium role, users can view and add tasks from GitHub milestones. For simplification, the admin role does not have specific functionalities assigned but inherits all others. The active role should be visible in the application interface.

- The access control policy is implemented using the Casbin library [5]. The policy is loaded at the beginning of the application and used by the library when needed at the policy enforcement points (PEP) of the application. You can test different types of policies using the [Casbin Web Editor](https://casbin.org/editor/).

- The authentication state between the browser and the web application is maintained through cookies.

- Data saved for each user may exist only in memory.

## Context Note

**Note:** This project was developed as part of a college curriculum unit on computer security. The focus is on implementing authentication and access control mechanisms using industry-standard protocols and libraries.

## Getting Started

1. Clone the repository.
2. Install dependencies using `npm install`.
3. Configure environment variables for Google Tasks API and GitHub integration.
4. Navigate to the `src` directory
5. Run the application using `npm start`.
6. Access the application at `http://localhost:3001`.

Feel free to explore the features and roles specified in the application. Enjoy task management with Google Tasks and GitHub Milestones integration!

