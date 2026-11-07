# Module 7: Deployment and Monitoring of Spring Boot Applications

## Learning Outcomes
Upon completion of this module, you will be able to:
- Package Spring Boot applications for deployment.
- Understand different deployment strategies (JAR, Docker, Cloud).
- Configure logging effectively for production environments.
- Monitor Spring Boot applications using Actuator and external tools.
- Implement basic health checks and readiness probes.
- Understand continuous integration and continuous delivery (CI/CD) concepts.

## Topics Covered

### 7.1 Packaging Spring Boot Applications
- Executable JARs: `spring-boot-maven-plugin` / `spring-boot-gradle-plugin`.
- Fat JARs vs. Thin JARs.
- War files for traditional servlet containers (less common with Spring Boot).

### 7.2 Deployment Strategies
- Deploying as a standalone JAR.
- Dockerizing Spring Boot applications:
    - Creating `Dockerfile`.
    - Multi-stage builds.
    - Container orchestration basics (Docker Compose, Kubernetes - brief mention).
- Cloud deployment (Heroku, AWS Elastic Beanstalk, Google Cloud Run, Azure App Service - conceptual overview).

### 7.3 Logging in Production
- SLF4J and Logback/Log4j2.
- Configuring logging levels (`application.properties`/`application.yml`).
- Structured logging (JSON logging).
- Centralized logging solutions (ELK Stack, Splunk, Grafana Loki - conceptual overview).

### 7.4 Monitoring with Spring Boot Actuator
- Review of Actuator endpoints (`/health`, `/info`, `/metrics`, `/env`, `/beans`).
- Custom metrics with Micrometer.
- Integrating with Prometheus and Grafana (conceptual overview).
- Distributed tracing with Spring Cloud Sleuth and Zipkin (conceptual overview).

### 7.5 Health Checks and Readiness Probes
- Liveness and Readiness probes for containerized environments.
- Customizing Actuator health indicators for deployment readiness.

### 7.6 CI/CD for Spring Boot Applications
- Introduction to Continuous Integration (CI) and Continuous Delivery (CD).
- Common CI/CD tools (Jenkins, GitLab CI, GitHub Actions, Azure DevOps - conceptual overview).
- Building a simple CI/CD pipeline for a Spring Boot application (conceptual steps).

## Exercises
1.  Create a simple Spring Boot application.
2.  Package the application as an executable JAR and run it from the command line.
3.  Create a `Dockerfile` to containerize your Spring Boot application. Build and run the Docker image.
4.  Configure Logback to output logs in JSON format.
5.  Add a custom metric using Micrometer to track the number of times a specific API endpoint is called.
6.  (Optional) Explore a simple CI/CD pipeline configuration (e.g., using GitHub Actions) to build and test your Spring Boot application.

## Quiz Questions
1.  What is the primary tool used to package a Spring Boot application into an executable JAR?
    a) Maven `jar` plugin.
    b) `spring-boot-maven-plugin`.
    c) `maven-compiler-plugin`.
    d) `exec-maven-plugin`.

2.  Which of the following is a benefit of Dockerizing a Spring Boot application?
    a) Eliminates the need for a JVM.
    b) Provides consistent environments across development, testing, and production.
    c) Automatically scales the application.
    d) Reduces application startup time.

3.  Which Spring Boot Actuator endpoint provides information about the application's health?
    a) `/actuator/info`
    b) `/actuator/metrics`
    c) `/actuator/health`
    d) `/actuator/env`

4.  What is the main purpose of a "readiness probe" in a containerized environment?
    a) To check if the application is running.
    b) To determine if the application is ready to serve traffic.
    c) To monitor application performance.
    d) To collect application logs.
