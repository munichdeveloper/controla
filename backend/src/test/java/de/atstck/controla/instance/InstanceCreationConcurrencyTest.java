package de.atstck.controla.instance;

import de.atstck.controla.alerts.InstanceAlertHandler;
import de.atstck.controla.dto.CreateInstanceDto;
import de.atstck.controla.dto.InstanceSummaryDto;
import de.atstck.controla.license.LicenseService;
import de.atstck.controla.security.CryptoService;
import de.atstck.controla.security.TenantContext;
import de.atstck.controla.service.CoreApiClient;
import de.atstck.controla.service.N8nApiClient;
import jakarta.persistence.EntityManagerFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.crypto.SecretKey;
import javax.sql.DataSource;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.*;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Independent Spring contexts share PostgreSQL, as separate backend processes would. */
@Testcontainers
class InstanceCreationConcurrencyTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private final CryptoService crypto = mock(CryptoService.class);
    private final LicenseService license = mock(LicenseService.class);
    private final N8nApiClient n8n = mock(N8nApiClient.class);
    private AnnotationConfigApplicationContext first;
    private AnnotationConfigApplicationContext second;
    private JdbcTemplate jdbc;

    @BeforeAll
    static void migrate() {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .load().migrate();
    }

    @BeforeEach
    void setUp() {
        when(crypto.getMasterKey()).thenReturn(mock(SecretKey.class));
        when(crypto.encrypt(any(), any())).thenReturn("encrypted-key");
        when(n8n.getLatestN8nVersion()).thenReturn("1.0.0");
        first = context();
        second = context();
        jdbc = new JdbcTemplate(first.getBean(DataSource.class));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        if (second != null) second.close();
        if (first != null) first.close();
    }

    @ParameterizedTest
    @CsvSource({"Community Edition, 3, 2", "Hosted Ops, 1, 0"})
    void concurrentCreatesCannotExceedTheLimitEvenForAnEmptyTenant(String edition, int limit, int existing)
            throws Exception {
        when(license.getEditionName()).thenReturn(edition);
        when(license.getMaxInstances()).thenReturn(limit);
        String tenant = UUID.randomUUID().toString();
        for (int i = 0; i < existing; i++) create(first, tenant);

        CountDownLatch admitted = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        pauseFirstCreation(admitted, release);
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            Future<InstanceSummaryDto> winner = workers.submit(() -> create(first, tenant));
            assertThat(admitted.await(10, TimeUnit.SECONDS)).isTrue();
            Future<InstanceSummaryDto> contender = workers.submit(() -> create(second, tenant));

            // Observe the database wait, rather than relying on thread timing or a JVM lock.
            await().atMost(Duration.ofSeconds(10)).until(() -> waitingLocks() > 0 || contender.isDone());
            assertThat(waitingLocks()).isEqualTo(1);
            assertThat(contender.isDone()).isFalse();
            release.countDown();

            assertThat(winner.get(10, TimeUnit.SECONDS)).isNotNull();
            assertThatThrownBy(() -> contender.get(10, TimeUnit.SECONDS))
                    .isInstanceOf(ExecutionException.class)
                    .hasCauseInstanceOf(InstanceLimitExceededException.class);
            assertThat(repository(first).countByTenantId(tenant)).isEqualTo(limit);
        } finally {
            release.countDown();
            workers.shutdown();
            assertThat(workers.awaitTermination(15, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test
    void differentTenantsDoNotBlockEachOther() throws Exception {
        when(license.getMaxInstances()).thenReturn(3);
        CountDownLatch admitted = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        pauseFirstCreation(admitted, release);
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            Future<InstanceSummaryDto> blocked = workers.submit(() -> create(first, "tenant-a"));
            assertThat(admitted.await(10, TimeUnit.SECONDS)).isTrue();
            Future<InstanceSummaryDto> independent = workers.submit(() -> create(second, "tenant-b"));

            assertThat(independent.get(10, TimeUnit.SECONDS)).isNotNull();
            assertThat(blocked.isDone()).isFalse();
            release.countDown();
            assertThat(blocked.get(10, TimeUnit.SECONDS)).isNotNull();
        } finally {
            release.countDown();
            workers.shutdown();
            assertThat(workers.awaitTermination(15, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test
    void failedCreationRollsBackAndReleasesTheTenantLock() {
        when(license.getMaxInstances()).thenReturn(1);
        when(n8n.getLatestN8nVersion()).thenThrow(new IllegalStateException("creation failed"))
                .thenReturn("1.0.0");
        String tenant = UUID.randomUUID().toString();

        assertThatThrownBy(() -> create(first, tenant)).isInstanceOf(IllegalStateException.class);
        assertThat(repository(first).countByTenantId(tenant)).isZero();
        assertThat(create(second, tenant)).isNotNull();
        assertThat(repository(first).countByTenantId(tenant)).isEqualTo(1);
    }

    @Test
    void hostedOpsStillAllowsMoreThanThreeInstances() {
        when(license.getMaxInstances()).thenReturn(-1);
        String tenant = UUID.randomUUID().toString();

        for (int i = 0; i < 5; i++) create(i % 2 == 0 ? first : second, tenant);

        assertThat(repository(first).countByTenantId(tenant)).isEqualTo(5);
    }

    private void pauseFirstCreation(CountDownLatch admitted, CountDownLatch release) {
        AtomicBoolean firstCall = new AtomicBoolean(true);
        SecretKey key = mock(SecretKey.class);
        when(crypto.getMasterKey()).thenAnswer(invocation -> {
            if (firstCall.compareAndSet(true, false)) {
                admitted.countDown();
                if (!release.await(20, TimeUnit.SECONDS)) throw new IllegalStateException("Test timed out");
            }
            return key;
        });
    }

    private int waitingLocks() {
        return jdbc.queryForObject("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted",
                Integer.class);
    }

    private static InstanceSummaryDto create(AnnotationConfigApplicationContext context, String tenant) {
        TenantContext.setTenantId(tenant);
        try {
            return context.getBean(InstanceService.class).createInstance(
                    new CreateInstanceDto("Test instance", "https://n8n.example.com", "test-key"));
        } finally {
            TenantContext.clear();
        }
    }

    private static InstanceRepository repository(AnnotationConfigApplicationContext context) {
        return context.getBean(InstanceRepository.class);
    }

    private AnnotationConfigApplicationContext context() {
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        context.registerBean(DataSource.class, () -> new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
        context.registerBean("entityManagerFactory", LocalContainerEntityManagerFactoryBean.class, () -> {
            LocalContainerEntityManagerFactoryBean factory = new LocalContainerEntityManagerFactoryBean();
            factory.setDataSource(context.getBean(DataSource.class));
            factory.setPackagesToScan(Instance.class.getPackageName());
            factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "validate",
                    "hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy"));
            return factory;
        });
        context.registerBean("transactionManager", JpaTransactionManager.class,
                () -> new JpaTransactionManager(context.getBean(EntityManagerFactory.class)));
        context.registerBean(CoreApiClient.class, () -> mock(CoreApiClient.class));
        context.registerBean(N8nApiClient.class, () -> n8n);
        context.registerBean(CryptoService.class, () -> crypto);
        context.registerBean(LicenseService.class, () -> license);
        context.registerBean(InstanceAlertHandler.class, () -> mock(InstanceAlertHandler.class));
        context.registerBean(InstanceCredentialService.class, () -> new InstanceCredentialService(crypto));
        context.register(Persistence.class, InstanceService.class);
        context.refresh();
        return context;
    }

    @Configuration
    @EnableTransactionManagement
    @EnableJpaRepositories(basePackageClasses = InstanceRepository.class)
    static class Persistence {
    }
}
