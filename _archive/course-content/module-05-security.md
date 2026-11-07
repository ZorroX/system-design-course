# Module 5: Securing Spring Boot Applications with Spring Security

## Learning Outcomes
Upon completion of this module, you will be able to:
- Understand fundamental security concepts in web applications.
- Integrate Spring Security into a Spring Boot application.
- Configure authentication mechanisms (in-memory, JDBC, custom UserDetailsService).
- Implement authorization rules using role-based access control.
- Secure REST APIs with token-based authentication (JWT).
- Understand common security vulnerabilities and how Spring Security mitigates them.

## Topics Covered

### 5.1 Introduction to Web Security
- Common web vulnerabilities (OWASP Top 10).
- Authentication vs. Authorization.
- Role of Spring Security in a Spring Boot application.

### 5.2 Spring Security Fundamentals
- `WebSecurityConfigurerAdapter` (deprecated in Spring Security 5.7+, but good for conceptual understanding).
- `SecurityFilterChain` and `SecurityConfig` class.
- `HttpSecurity` configuration.
- `UserDetailsService` and `PasswordEncoder`.

### 5.3 Authentication Mechanisms
- In-memory authentication.
- JDBC-based authentication.
- Custom `UserDetailsService` for database authentication.
- Integrating with LDAP/OAuth2 (brief overview).

### 5.4 Authorization and Access Control
- Role-based access control (`@PreAuthorize`, `hasRole()`, `hasAuthority()`).
- Method-level security.
- Expression-based access control.

### 5.5 Securing REST APIs with JWT
- Introduction to JSON Web Tokens (JWT).
- Generating and validating JWTs.
- Implementing a JWT authentication filter.
- Storing JWTs securely.

### 5.6 Cross-Site Request Forgery (CSRF) Protection
- Understanding CSRF attacks.
- How Spring Security handles CSRF.
- Disabling CSRF for stateless REST APIs.

### 5.7 Other Security Considerations
- HTTPS/SSL configuration.
- CORS (Cross-Origin Resource Sharing).
- Security headers.
- Password storage best practices.

## Exercises
1.  Create a new Spring Boot project and add `spring-boot-starter-security` and `spring-boot-starter-web` dependencies.
2.  Configure in-memory authentication with two users: `user` (ROLE_USER) and `admin` (ROLE_ADMIN).
3.  Create a simple REST endpoint `/public` accessible to all, `/user` accessible to ROLE_USER, and `/admin` accessible to ROLE_ADMIN.
4.  Implement a custom `UserDetailsService` that loads user details from a simulated database (e.g., a `HashMap`).
5.  Integrate JWT authentication:
    *   Create an authentication endpoint (`/authenticate`) that returns a JWT.
    *   Implement a filter to validate JWTs for subsequent requests.
    *   Secure your `/user` and `/admin` endpoints using JWT.
6.  Disable CSRF protection for your REST API.

## Quiz Questions
1.  What is the primary difference between authentication and authorization?
    a) Authentication verifies who you are, while authorization determines what you can do.
    b) Authorization verifies who you are, while authentication determines what you can do.
    c) They are interchangeable terms.
    d) Authentication is for web applications, authorization is for APIs.

2.  Which component in Spring Security is responsible for loading user-specific data during the authentication process?
    a) `PasswordEncoder`
    b) `AuthenticationManager`
    c) `UserDetailsService`
    d) `SecurityContextHolder`

3.  Which of the following is a common method for securing REST APIs in Spring Boot?
    a) Session-based authentication.
    b) JWT (JSON Web Token) authentication.
    c) Basic HTTP authentication only.
    d) OAuth1.

4.  When building a stateless REST API, why might you disable CSRF protection in Spring Security?
    a) CSRF protection is not needed for any REST API.
    b) Stateless APIs typically don't use sessions, which CSRF protection relies on.
    c) Disabling it improves performance significantly.
    d) It's a security best practice to always disable CSRF for REST APIs.
