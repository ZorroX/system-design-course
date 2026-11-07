# Module 4: Building RESTful APIs with Spring Boot

## Learning Outcomes
Upon completion of this module, you will be able to:
- Design and implement RESTful web services using Spring Boot.
- Understand HTTP methods and their appropriate use in REST APIs.
- Handle request and response bodies using `@RequestBody` and `@ResponseBody`.
- Implement request parameter and path variable handling.
- Apply validation to incoming request data.
- Implement error handling and exception management in REST APIs.
- Document REST APIs using OpenAPI (Swagger).

## Topics Covered

### 4.1 Introduction to REST and RESTful Principles
- What is REST? Architectural constraints (Stateless, Client-Server, Cacheable, Layered System, Uniform Interface, Code-On-Demand - optional).
- Resources and URIs.
- HTTP methods (GET, POST, PUT, DELETE, PATCH) and their idempotency/safety.
- Status codes (2xx, 4xx, 5xx).

### 4.2 Creating REST Controllers
- `@RestController` and `@RequestMapping`.
- `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`.
- Handling request parameters (`@RequestParam`) and path variables (`@PathVariable`).
- Request and response bodies (`@RequestBody`, `@ResponseBody`).

### 4.3 Data Transfer Objects (DTOs)
- Why use DTOs? Separating domain models from API models.
- Mapping between entities and DTOs (e.g., using ModelMapper or MapStruct).

### 4.4 Request Validation
- Bean Validation API (JSR 380) with Hibernate Validator.
- `@Valid` and validation annotations (`@NotNull`, `@Size`, `@Min`, `@Max`, `@Email`, etc.).
- Custom validation annotations.

### 4.5 Exception Handling in REST APIs
- `@ExceptionHandler` for local exception handling.
- `@ControllerAdvice` and `@RestControllerAdvice` for global exception handling.
- `ResponseEntityExceptionHandler` for common Spring MVC exceptions.
- Custom error responses.

### 4.6 API Versioning
- Strategies for API versioning (URI, Request Parameter, Header, Content Negotiation).
- Best practices and considerations.

### 4.7 Documenting REST APIs with OpenAPI (Swagger)
- Introduction to OpenAPI Specification.
- Integrating Springdoc OpenAPI with Spring Boot.
- Annotations for documenting controllers, operations, and models.
- Accessing Swagger UI.

## Exercises
1.  Create a Spring Boot project with `spring-boot-starter-web`.
2.  Develop a RESTful API for managing `Book` resources (id, title, author, isbn). Implement GET (all, by id), POST, PUT, DELETE endpoints.
3.  Create a `BookDTO` for request and response bodies, and map it to the `Book` entity.
4.  Add validation to the `BookDTO` (e.g., `title` and `author` cannot be empty, `isbn` must be a specific length).
5.  Implement global exception handling for `ResourceNotFoundException` and `MethodArgumentNotValidException`.
6.  Integrate Springdoc OpenAPI and document your `Book` API. Access the Swagger UI.

## Quiz Questions
1.  Which HTTP method is typically used to retrieve a resource from a RESTful API?
    a) POST
    b) PUT
    c) GET
    d) DELETE

2.  What is the purpose of a Data Transfer Object (DTO) in a RESTful API?
    a) To directly expose database entities to the client.
    b) To transfer data between different layers of an application, often separating domain models from API representations.
    c) To perform database operations.
    d) To handle security authentication.

3.  Which annotation is used to apply validation rules to an object in a Spring Boot controller method?
    a) `@Validated`
    b) `@Valid`
    c) `@Constraint`
    d) `@Pattern`

4.  To implement global exception handling for all REST controllers in a Spring Boot application, which annotation would you typically use on a class?
    a) `@ExceptionHandler`
    b) `@ControllerAdvice`
    c) `@ResponseStatus`
    d) `@RestController`
