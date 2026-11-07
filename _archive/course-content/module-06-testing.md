# Module 6: Testing Spring Boot Applications

## Learning Outcomes
Upon completion of this module, you will be able to:
- Understand the importance of testing in production-ready applications.
- Implement unit tests for various components (services, repositories).
- Write integration tests for REST controllers and data access layers.
- Utilize Spring Boot's testing utilities and annotations.
- Mock dependencies effectively using Mockito.
- Perform end-to-end testing with tools like Testcontainers (brief overview).

## Topics Covered

### 6.1 Introduction to Testing in Spring Boot
- Why test? Benefits of a robust test suite.
- Types of tests: Unit, Integration, End-to-End.
- Test pyramid concept.
- Spring Boot's testing philosophy.

### 6.2 Unit Testing with JUnit 5 and Mockito
- JUnit 5 basics: `@Test`, `@DisplayName`, `@BeforeEach`, `@AfterEach`.
- Mockito: `@Mock`, `@InjectMocks`, `when().thenReturn()`, `verify()`.
- Testing service layer components.
- Testing utility classes.

### 6.3 Integration Testing with Spring Boot Test
- `@SpringBootTest`: Loading the full application context.
- `@WebMvcTest`: Testing REST controllers in isolation (mocking service layer).
- `@DataJpaTest`: Testing JPA repositories (in-memory database).
- `@JdbcTest`: Testing JDBC components.
- `@AutoConfigureMockMvc` and `MockMvc` for HTTP request simulation.

### 6.4 Testing REST APIs
- Using `MockMvc` to test controller endpoints.
- JSON assertions with `jsonPath()`.
- Testing request parameters, path variables, and request bodies.
- Testing error responses.

### 6.5 Testing Data Access Layer
- Using `@DataJpaTest` with an in-memory database (H2).
- Verifying data persistence and retrieval.
- Testing custom repository methods.

### 6.6 Testcontainers (Brief Overview)
- Introduction to Testcontainers for integration testing with real services (databases, message brokers).
- Benefits and basic usage.

## Exercises
1.  Create a Spring Boot project with `spring-boot-starter-test` (includes JUnit, Mockito, Spring Test).
2.  Develop a simple `ProductService` and `ProductRepository`.
3.  Write unit tests for `ProductService` using Mockito to mock `ProductRepository`.
4.  Implement an integration test for a `ProductController` using `@WebMvcTest` and `MockMvc`. Mock the `ProductService`.
5.  Write an integration test for `ProductRepository` using `@DataJpaTest` to verify CRUD operations.
6.  (Optional) Explore Testcontainers by setting up a simple test that uses a PostgreSQL container for your data access layer tests.

## Quiz Questions
1.  Which annotation is used to load the full Spring Boot application context for integration tests?
    a) `@WebMvcTest`
    b) `@DataJpaTest`
    c) `@SpringBootTest`
    d) `@ExtendWith(MockitoExtension.class)`

2.  What is the primary purpose of Mockito in unit testing?
    a) To create real instances of dependencies.
    b) To simulate the behavior of dependencies and isolate the unit under test.
    c) To run tests in a web environment.
    d) To manage database transactions during tests.

3.  Which utility is commonly used to simulate HTTP requests and verify responses in Spring Boot REST controller tests?
    a) `RestTemplate`
    b) `WebClient`
    c) `MockMvc`
    d) `TestRestTemplate`

4.  When would you typically use `@DataJpaTest`?
    a) To test the entire web layer of an application.
    b) To test only the service layer logic.
    c) To focus on testing JPA entities and repositories.
    d) To test external APIs.
