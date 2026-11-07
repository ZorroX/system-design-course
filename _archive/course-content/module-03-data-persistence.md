# Module 3: Data Persistence with Spring Boot and Spring Data JPA

## Learning Outcomes
Upon completion of this module, you will be able to:
- Understand the fundamentals of relational database interaction in Spring Boot.
- Utilize Spring Data JPA for simplified data access.
- Define and manage entities, repositories, and relationships.
- Perform basic CRUD operations using Spring Data JPA.
- Implement custom queries and advanced repository features.
- Configure different database types (H2, PostgreSQL, MySQL).

## Topics Covered

### 3.1 Introduction to Spring Data JPA
- What is JPA (Java Persistence API)?
- Role of Hibernate as a JPA implementation.
- Spring Data JPA: Abstraction over JPA for simplified repository creation.
- Benefits of using Spring Data JPA.

### 3.2 Entities and Relationships
- Defining JPA entities with `@Entity`, `@Id`, `@GeneratedValue`.
- Basic data types and their mapping.
- Entity relationships: `@OneToOne`, `@OneToMany`, `@ManyToOne`, `@ManyToMany`.
- Fetch types (EAGER vs. LAZY).
- Cascading operations.

### 3.3 Spring Data JPA Repositories
- `CrudRepository`, `PagingAndSortingRepository`, `JpaRepository`.
- Method name conventions for query generation (e.g., `findByLastName`, `findByAgeGreaterThan`).
- Custom queries with `@Query` annotation (JPQL and native SQL).
- Transaction management with `@Transactional`.

### 3.4 CRUD Operations
- Saving entities (`save()`).
- Retrieving entities (`findById()`, `findAll()`).
- Updating entities.
- Deleting entities (`deleteById()`, `deleteAll()`).

### 3.5 Advanced Repository Features
- Pagination and sorting.
- Query by Example.
- Specifications API (for complex dynamic queries).
- Projections (interface-based and class-based).

### 3.6 Database Configuration
- In-memory databases (H2 for development and testing).
- Configuring external databases (PostgreSQL, MySQL) with `application.properties`/`application.yml`.
- Connection pooling (HikariCP).
- Database initialization (schema.sql, data.sql).

## Exercises
1.  Create a Spring Boot project with `spring-boot-starter-data-jpa` and `H2` dependencies.
2.  Define a simple `Product` entity with `id`, `name`, and `price` fields.
3.  Create a `ProductRepository` interface extending `JpaRepository`.
4.  Implement a `CommandLineRunner` to save a few products and retrieve them using the repository.
5.  Add a `Category` entity and establish a `@ManyToOne` relationship between `Product` and `Category`.
6.  Write a custom query in `ProductRepository` to find products by a given name using `@Query`.
7.  Configure the application to connect to an external PostgreSQL database (you can use Docker for a local instance).

## Quiz Questions
1.  What is the main purpose of Spring Data JPA?
    a) To replace SQL entirely.
    b) To simplify data access layer implementation using JPA.
    c) To provide a new database management system.
    d) To only support NoSQL databases.

2.  Which annotation is used to mark a class as a JPA entity?
    a) `@Repository`
    b) `@Component`
    c) `@Entity`
    d) `@Table`

3.  Which of the following interfaces provides basic CRUD operations in Spring Data JPA?
    a) `JpaRepository`
    b) `DataSource`
    c) `EntityManager`
    d) `JdbcTemplate`

4.  What is the default fetch type for a `@ManyToOne` relationship in JPA?
    a) `EAGER`
    b) `LAZY`
    c) `FETCH`
    d) `JOIN`
