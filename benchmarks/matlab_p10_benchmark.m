function matlab_p10_benchmark()
%MATLAB_P10_BENCHMARK Reproducible MATLAB timings for Key Result #3.
%
% Measures the same P=10 reference operations used by the Python benchmark.
% Wall time uses TIC/TOC and CPU time uses CPUTIME. The original scientific
% source files are not modified.

repo_dir = fileparts(fileparts(mfilename('fullpath')));
addpath(repo_dir);
output_dir = fullfile(repo_dir,'benchmark_outputs');
if ~exist(output_dir,'dir')
    mkdir(output_dir);
end

warning('off','all');
loaded = load(fullfile(repo_dir,'testing_inversion_currtest.mat'));
warning('on','all');

domain = loaded.domain;
bdrys = loaded.bdrys;
experiment = loaded.experiment;
params_true = loaded.params_true;

[rebuilt_experiment,input_timing] = measure_call(@() ...
    OHT_create_inputs(loaded.well_locs,loaded.test_list,domain));
input_error = max(abs(full(rebuilt_experiment.stims-experiment.stims)),[],'all');

[observations,observation_timing] = measure_call(@() ...
    OHT_run_distribKSs(params_true,domain,bdrys,experiment,1));
[fields,field_timing] = measure_call(@() ...
    OHT_run_distribKSs(params_true,domain,bdrys,experiment,2));

sensitivity_parameters = [-9.*ones(2500,1); -9.*ones(2500,1)];
[sensitivity,sensitivity_timing] = measure_call(@() ...
    OHT_run_distribKSs(sensitivity_parameters,domain,bdrys,experiment,3));

num_x = numel(domain.x)-1;
num_y = numel(domain.y)-1;
Qproduct = @(vector) covar_product_K_Ss(...
    loaded.QK_row,loaded.QSs_row,vector,num_x,num_y);
forward = @(parameters) OHT_run_distribKSs(...
    parameters,domain,bdrys,experiment,1);
jacobian = @(parameters) OHT_run_distribKSs(...
    parameters,domain,bdrys,experiment,3);

[inversion,inversion_timing] = measure_call(@() run_inversion(...
    loaded.y,loaded.params_init,loaded.beta_init,loaded.X,loaded.R,...
    Qproduct,forward,jacobian));

report.environment.matlab = version;
report.environment.computer = computer;
report.environment.numcores = feature('numcores');
report.method.wall_timer = 'tic/toc';
report.method.cpu_timer = 'cputime';
report.method.repetitions = 1;
report.p10_input_build = input_timing;
report.p10_input_build.max_absolute_difference = input_error;
report.p10_observations = observation_timing;
report.p10_observations.max_absolute_difference = max(abs(observations-loaded.sim_obs));
report.p10_observations.relative_l2_difference = norm(observations-loaded.sim_obs)./norm(loaded.sim_obs);
report.p10_full_fields = field_timing;
report.p10_full_fields.max_absolute_difference = max(abs(fields-loaded.Phi_true),[],'all');
report.p10_full_fields.relative_l2_difference = norm(fields-loaded.Phi_true,'fro')./norm(loaded.Phi_true,'fro');
report.p10_sensitivity = sensitivity_timing;
report.p10_sensitivity.max_absolute_difference = max(abs(sensitivity-loaded.H_adj),[],'all');
report.p10_sensitivity.relative_l2_difference = norm(sensitivity-loaded.H_adj,'fro')./norm(loaded.H_adj,'fro');
report.p10_inversion = inversion_timing;
report.p10_inversion.iterations_not_exposed = true;
report.p10_inversion.final_nlap = inversion.nlap;
report.p10_inversion.max_absolute_parameter_difference = max(abs(inversion.parameters-loaded.params_best));
report.p10_inversion.relative_parameter_l2_difference = norm(inversion.parameters-loaded.params_best)./norm(loaded.params_best);

json_text = jsonencode(report,PrettyPrint=true);
json_path = fullfile(output_dir,'matlab_p10_benchmark.json');
file_id = fopen(json_path,'w');
fprintf(file_id,'%s',json_text);
fclose(file_id);
disp(json_text);
disp(['Saved ',json_path]);
end


function [value,timing] = measure_call(function_handle)
wall_start = tic;
cpu_start = cputime;
value = function_handle();
timing.wall_seconds = toc(wall_start);
timing.cpu_seconds = cputime-cpu_start;
timing.cpu_to_wall_ratio = timing.cpu_seconds./timing.wall_seconds;
end


function result = run_inversion(y,params_init,beta_init,X,R,Q,forward,jacobian)
[parameters,beta,sensitivity,nlap] = ql_geostat_inv(...
    y,params_init,beta_init,X,R,Q,forward,jacobian);
result.parameters = parameters;
result.beta = beta;
result.sensitivity = sensitivity;
result.nlap = nlap;
end
