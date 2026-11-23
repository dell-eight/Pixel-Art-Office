BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Employee] (
    [id] NVARCHAR(32) NOT NULL,
    [name] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(64) NOT NULL,
    [sortOrder] INT NOT NULL,
    [activeVersion] INT NOT NULL CONSTRAINT [Employee_activeVersion_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Employee_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Employee_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SkillVersion] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [employeeId] NVARCHAR(32) NOT NULL,
    [version] INT NOT NULL,
    [skillJson] NVARCHAR(max) NOT NULL,
    [note] NVARCHAR(400),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SkillVersion_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SkillVersion_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SkillVersion_employeeId_version_key] UNIQUE NONCLUSTERED ([employeeId],[version])
);

-- CreateTable
CREATE TABLE [dbo].[Job] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [title] NVARCHAR(200) NOT NULL,
    [briefJson] NVARCHAR(max) NOT NULL,
    [state] NVARCHAR(32) NOT NULL CONSTRAINT [Job_state_df] DEFAULT 'BRIEFED',
    [mock] BIT NOT NULL CONSTRAINT [Job_mock_df] DEFAULT 1,
    [error] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Job_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Job_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[StageRun] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [jobId] UNIQUEIDENTIFIER NOT NULL,
    [stage] NVARCHAR(32) NOT NULL,
    [employeeId] NVARCHAR(32) NOT NULL,
    [status] NVARCHAR(16) NOT NULL,
    [attempt] INT NOT NULL CONSTRAINT [StageRun_attempt_df] DEFAULT 1,
    [inputHash] NVARCHAR(64) NOT NULL,
    [outputJson] NVARCHAR(max),
    [error] NVARCHAR(max),
    [startedAt] DATETIME2 NOT NULL CONSTRAINT [StageRun_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [finishedAt] DATETIME2,
    CONSTRAINT [StageRun_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Artifact] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [jobId] UNIQUEIDENTIFIER NOT NULL,
    [stageRunId] UNIQUEIDENTIFIER,
    [kind] NVARCHAR(32) NOT NULL,
    [path] NVARCHAR(400) NOT NULL,
    [mime] NVARCHAR(64) NOT NULL,
    [metaJson] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Artifact_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Artifact_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[LogEntry] (
    [id] INT NOT NULL IDENTITY(1,1),
    [jobId] UNIQUEIDENTIFIER,
    [employeeId] NVARCHAR(32),
    [level] NVARCHAR(8) NOT NULL,
    [message] NVARCHAR(max) NOT NULL,
    [dataJson] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LogEntry_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [LogEntry_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[GateDecision] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [jobId] UNIQUEIDENTIFIER NOT NULL,
    [gate] NVARCHAR(32) NOT NULL,
    [decision] NVARCHAR(16) NOT NULL,
    [comment] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GateDecision_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [GateDecision_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Price] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [provider] NVARCHAR(32) NOT NULL,
    [model] NVARCHAR(100) NOT NULL,
    [unit] NVARCHAR(32) NOT NULL,
    [unitPriceUsd] DECIMAL(18,6) NOT NULL,
    [sourceUrl] NVARCHAR(400) NOT NULL,
    [checkedAt] DATETIME2 NOT NULL,
    [verified] BIT NOT NULL CONSTRAINT [Price_verified_df] DEFAULT 0,
    CONSTRAINT [Price_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Price_provider_model_unit_key] UNIQUE NONCLUSTERED ([provider],[model],[unit])
);

-- CreateTable
CREATE TABLE [dbo].[LedgerEntry] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [jobId] UNIQUEIDENTIFIER,
    [stageRunId] UNIQUEIDENTIFIER,
    [provider] NVARCHAR(32) NOT NULL,
    [model] NVARCHAR(100) NOT NULL,
    [units] DECIMAL(18,6) NOT NULL,
    [estUsd] DECIMAL(18,6) NOT NULL,
    [actualUsd] DECIMAL(18,6),
    [status] NVARCHAR(16) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LedgerEntry_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [LedgerEntry_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Setting] (
    [key] NVARCHAR(64) NOT NULL,
    [valueJson] NVARCHAR(max) NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Setting_pkey] PRIMARY KEY CLUSTERED ([key])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Job_state_idx] ON [dbo].[Job]([state]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StageRun_jobId_stage_idx] ON [dbo].[StageRun]([jobId], [stage]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [StageRun_stage_inputHash_idx] ON [dbo].[StageRun]([stage], [inputHash]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Artifact_jobId_kind_idx] ON [dbo].[Artifact]([jobId], [kind]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LogEntry_jobId_createdAt_idx] ON [dbo].[LogEntry]([jobId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LogEntry_employeeId_createdAt_idx] ON [dbo].[LogEntry]([employeeId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GateDecision_jobId_gate_idx] ON [dbo].[GateDecision]([jobId], [gate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LedgerEntry_jobId_idx] ON [dbo].[LedgerEntry]([jobId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LedgerEntry_createdAt_idx] ON [dbo].[LedgerEntry]([createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[SkillVersion] ADD CONSTRAINT [SkillVersion_employeeId_fkey] FOREIGN KEY ([employeeId]) REFERENCES [dbo].[Employee]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[StageRun] ADD CONSTRAINT [StageRun_jobId_fkey] FOREIGN KEY ([jobId]) REFERENCES [dbo].[Job]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Artifact] ADD CONSTRAINT [Artifact_jobId_fkey] FOREIGN KEY ([jobId]) REFERENCES [dbo].[Job]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LogEntry] ADD CONSTRAINT [LogEntry_jobId_fkey] FOREIGN KEY ([jobId]) REFERENCES [dbo].[Job]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[GateDecision] ADD CONSTRAINT [GateDecision_jobId_fkey] FOREIGN KEY ([jobId]) REFERENCES [dbo].[Job]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LedgerEntry] ADD CONSTRAINT [LedgerEntry_jobId_fkey] FOREIGN KEY ([jobId]) REFERENCES [dbo].[Job]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
