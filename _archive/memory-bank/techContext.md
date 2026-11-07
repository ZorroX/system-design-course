# Tech Context: Production-Ready Java with Spring Boot Course

## Technologies used (within the course content)

The course will primarily focus on the following technologies:

- **Programming Language:** Java (modern versions, e.g., Java 17+ for LTS)
- **Core Framework:** Spring Framework
- **Application Framework:** Spring Boot (latest stable version)
- **Build Tools:** Maven (primary) and Gradle (secondary, for awareness)
- **Database:**
    - **Relational Database:** H2 (for in-memory testing/development), PostgreSQL/MySQL (for production-like scenarios)
    - **ORM:** Spring Data JPA, Hibernate
- **Asynchronous Programming:** Java's `CompletableFuture` API
- **Caching:** Spring's Cache Abstraction, Redis (as an external provider example)
- **Resilience Libraries:** Resilience4j (for Circuit Breaker, Rate Limiting, Retry)
- **Testing Frameworks:**
    - JUnit 5
    - Mockito
    - Spring Boot Test
    - AssertJ (for fluent assertions)
- **Web Framework:** Spring Web MVC (for REST APIs)
- **Logging:** SLF4J with Logback (default Spring Boot logging)

## Development setup (for learners)

Learners will need:
- **Java Development Kit (JDK):** Version 17 or higher.
- **Integrated Development Environment (IDE):** IntelliJ IDEA (recommended), VS Code with Java extensions, or Eclipse.
- **Build Tool:** Maven (pre-installed or integrated with IDE).
- **Version Control:** Git (basic familiarity assumed).
- **Docker (optional but recommended):** For running external services like Redis or PostgreSQL locally.

## Technical constraints (for the course content)

- **Focus on Spring Boot:** While Spring Framework concepts are covered, the emphasis is on the Spring Boot ecosystem for rapid application development.
- **Modern Java:** Examples will leverage modern Java features (e.g., records, `var` keyword where appropriate).
- **Opinionated Best Practices:** The course will guide learners towards established best practices in Spring Boot development.
- **No Frontend Frameworks:** The course will focus solely on backend development with Spring Boot, interacting with web layers via REST APIs.

## Dependencies (key libraries and their roles)

- `spring-boot-starter-web`: For building web applications, including RESTful services.
- `spring-boot-starter-data-jpa`: For database persistence with JPA and Hibernate.
- `spring-boot-starter-test`: For comprehensive testing support.
- `spring-boot-starter-cache`: For Spring's cache abstraction.
- `spring-boot-starter-data-redis`: For integrating with Redis.
- `resilience4j-spring-boot2`: For implementing resilience patterns.
- `h2`: In-memory database for development and testing.
- `postgresql` / `mysql-connector-java`: Database drivers for production-like environments.
- `lombok` (optional): For reducing boilerplate code (e.g., getters, setters).

## Tool usage patterns (within the course)

- **IDE Usage:** Demonstrations will show how to leverage IDE features for development, debugging, and testing.
- **Maven/Gradle:** How to manage dependencies, build projects, and run tests using these tools.
- **Postman/cURL:** For testing REST APIs developed in Spring Boot.
- **Database Clients:** Basic usage of database clients for verifying data persistence.
